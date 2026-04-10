import type { Organization, Test, TestSuite } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { anthropicError } from "@/lib/errors";
import {
  isMatchError,
  matchInput,
  normalizeRequest,
  parseTestSequence,
} from "@/lib/messages/matching";
import type {
  NormalizedInput,
  OutputMessage,
} from "@/lib/messages/types";
import type { MessagesRequestBody } from "@/lib/messages/request";

type MatchErrorDetail = {
  status: number;
  message: string;
  type: string;
  code: string;
};

export type MessageMatchSuccess = {
  ok: true;
  org: Organization;
  suite: TestSuite;
  test: Test;
  normalizedInput: NormalizedInput;
  outputMessage: OutputMessage;
};

export type MessageMatchError = {
  ok: false;
  response: NextResponse;
  error: MatchErrorDetail;
  org: Organization | null;
  suite: TestSuite | null;
  test: Test | null;
};

export type MessageMatchResult = MessageMatchSuccess | MessageMatchError;

type ResolveMatchInput = {
  orgSlug: string;
  suiteName: string;
  model: string;
  system: MessagesRequestBody["system"];
  messages: MessagesRequestBody["messages"];
  org?: Organization | null;
};

function buildError(
  status: number,
  message: string,
  type: string,
  code: string
): MatchErrorDetail {
  return { status, message, type, code };
}

export async function resolveMessageMatch({
  orgSlug,
  suiteName,
  model,
  system,
  messages,
  org: orgOverride,
}: ResolveMatchInput): Promise<MessageMatchResult> {
  const org =
    orgOverride ??
    (await prisma.organization.findUnique({
      where: { slug: orgSlug },
    }));
  if (!org) {
    const error = buildError(
      404,
      `Organization '${orgSlug}' not found`,
      "not_found_error",
      "org_not_found"
    );
    return {
      ok: false,
      response: anthropicError(error.status, error.message, error.type),
      error,
      org: null,
      suite: null,
      test: null,
    };
  }

  const suite = await prisma.testSuite.findUnique({
    where: { orgId_name: { orgId: org.id, name: suiteName } },
  });
  if (!suite) {
    const error = buildError(
      404,
      `Test suite '${suiteName}' not found in organization '${orgSlug}'`,
      "not_found_error",
      "suite_not_found"
    );
    return {
      ok: false,
      response: anthropicError(error.status, error.message, error.type),
      error,
      org,
      suite: null,
      test: null,
    };
  }

  if (suite.protocol !== "anthropic") {
    const error = buildError(
      400,
      `Test suite '${suiteName}' does not support the Anthropic protocol`,
      "invalid_request_error",
      "suite_protocol_mismatch"
    );
    return {
      ok: false,
      response: anthropicError(error.status, error.message, error.type),
      error,
      org,
      suite,
      test: null,
    };
  }

  const test = await prisma.test.findUnique({
    where: { testSuiteId_name: { testSuiteId: suite.id, name: model } },
  });
  if (!test) {
    const error = buildError(
      404,
      `Model '${model}' not found in suite '${suiteName}'`,
      "not_found_error",
      "model_not_found"
    );
    return {
      ok: false,
      response: anthropicError(error.status, error.message, error.type),
      error,
      org,
      suite,
      test: null,
    };
  }

  const rawSequence = await prisma.testItem.findMany({
    where: { testId: test.id },
    orderBy: { position: "asc" },
  });
  const sequence = parseTestSequence(rawSequence);

  const normalizedInput = normalizeRequest(system, messages);
  const result = matchInput(sequence, normalizedInput);
  if (isMatchError(result)) {
    return {
      ok: false,
      response: anthropicError(
        result.status,
        result.message,
        result.type
      ),
      error: result,
      org,
      suite,
      test,
    };
  }

  return {
    ok: true,
    org,
    suite,
    test,
    normalizedInput,
    outputMessage: result.outputMessage,
  };
}
