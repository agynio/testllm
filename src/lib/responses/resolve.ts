import type { Organization, Test, TestSuite } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { openaiError } from "@/lib/errors";
import {
  isMatchError,
  matchInput,
  normalizeInput,
  parseTestSequence,
} from "@/lib/responses/matching";
import type {
  NormalizedInputItem,
  OutputTestItem,
} from "@/lib/responses/types";
import type { ResponsesRequestBody } from "@/lib/responses/request";

type MatchErrorDetail = {
  status: number;
  message: string;
  type: string;
  code: string;
};

export type ResponseMatchSuccess = {
  ok: true;
  org: Organization;
  suite: TestSuite;
  test: Test;
  normalizedInput: NormalizedInputItem[];
  outputItems: OutputTestItem[];
};

export type ResponseMatchError = {
  ok: false;
  response: NextResponse;
  error: MatchErrorDetail;
  org: Organization | null;
  suite: TestSuite | null;
  test: Test | null;
};

export type ResponseMatchResult = ResponseMatchSuccess | ResponseMatchError;

type ResolveMatchInput = {
  orgSlug: string;
  suiteName: string;
  model: string;
  input: ResponsesRequestBody["input"];
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

export async function resolveResponseMatch({
  orgSlug,
  suiteName,
  model,
  input,
  org: orgOverride,
}: ResolveMatchInput): Promise<ResponseMatchResult> {
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
      response: openaiError(error.status, error.message, error.type, error.code),
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
      response: openaiError(error.status, error.message, error.type, error.code),
      error,
      org,
      suite: null,
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
      response: openaiError(error.status, error.message, error.type, error.code),
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

  const normalizedInput = normalizeInput(input);
  const result = matchInput(sequence, normalizedInput);
  if (isMatchError(result)) {
    return {
      ok: false,
      response: openaiError(
        result.status,
        result.message,
        result.type,
        result.code
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
    outputItems: result.outputItems,
  };
}
