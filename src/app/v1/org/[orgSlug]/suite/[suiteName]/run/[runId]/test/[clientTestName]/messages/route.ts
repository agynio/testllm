import { NextRequest } from "next/server";
import { Prisma, ResponseLogStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { anthropicError } from "@/lib/errors";
import {
  createMessageMetadata,
  formatResponse,
  formatSSEStream,
} from "@/lib/messages/formatting";
import { parseMessagesRequestBody } from "@/lib/messages/request";
import { resolveMessageMatch } from "@/lib/messages/resolve";

const RunIdSchema = z.string().uuid();
const ClientTestNameSchema = z.string().min(1);

type RunParams = {
  runId: string;
  clientTestName: string;
};

type RunParamParseResult =
  | { ok: true; data: RunParams }
  | { ok: false; error: Response };

function parseRunParams(runId: string, clientTestName: string): RunParamParseResult {
  const runIdResult = RunIdSchema.safeParse(runId);
  if (!runIdResult.success) {
    return {
      ok: false,
      error: anthropicError(
        400,
        "runId must be a valid UUID",
        "invalid_request_error"
      ),
    };
  }

  let decodedName: string;
  try {
    decodedName = decodeURIComponent(clientTestName);
  } catch {
    return {
      ok: false,
      error: anthropicError(
        400,
        "clientTestName must be URL encoded",
        "invalid_request_error"
      ),
    };
  }

  const trimmedName = decodedName.trim();
  const nameResult = ClientTestNameSchema.safeParse(trimmedName);
  if (!nameResult.success) {
    return {
      ok: false,
      error: anthropicError(
        400,
        "clientTestName must be provided",
        "invalid_request_error"
      ),
    };
  }

  return {
    ok: true,
    data: { runId: runIdResult.data, clientTestName: trimmedName },
  };
}

async function ensureTestRun(runId: string, orgId: string) {
  try {
    const run = await prisma.testRun.create({
      data: { id: runId, orgId },
    });
    return { ok: true as const, run };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const run = await prisma.testRun.findUnique({ where: { id: runId } });
      if (run && run.orgId === orgId) {
        return { ok: true as const, run };
      }
      return {
        ok: false as const,
        error: anthropicError(
          404,
          `Test run '${runId}' not found`,
          "not_found_error"
        ),
      };
    }
    throw error;
  }
}

function recordResponseLog(
  data: Prisma.ResponseLogCreateInput | Prisma.ResponseLogUncheckedCreateInput
) {
  void prisma.responseLog
    .create({ data })
    .catch((error) => console.error("Failed to record response log", error));
}

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      orgSlug: string;
      suiteName: string;
      runId: string;
      clientTestName: string;
    }>;
  }
) {
  const { orgSlug, suiteName, runId, clientTestName } = await params;

  const runParams = parseRunParams(runId, clientTestName);
  if (!runParams.ok) return runParams.error;

  const parsedRequest = await parseMessagesRequestBody(request);
  if (!parsedRequest.ok) return parsedRequest.error;

  const { model, system, messages, max_tokens, stream } = parsedRequest.data;
  const streamEnabled = stream === true;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) {
    return anthropicError(
      404,
      `Organization '${orgSlug}' not found`,
      "not_found_error"
    );
  }

  const runResult = await ensureTestRun(runParams.data.runId, org.id);
  if (!runResult.ok) return runResult.error;

  const startedAt = Date.now();
  const matchResult = await resolveMessageMatch({
    orgSlug,
    suiteName,
    model,
    system,
    messages,
    org,
  });
  const durationMs = Date.now() - startedAt;

  const inputPayload = {
    system: system ?? null,
    messages,
    max_tokens,
  } as Prisma.InputJsonValue;

  if (!matchResult.ok) {
    recordResponseLog({
      runId: runParams.data.runId,
      status: ResponseLogStatus.error,
      orgSlug,
      suiteName,
      model,
      clientTestName: runParams.data.clientTestName,
      input: inputPayload,
      stream: streamEnabled,
      suiteId: matchResult.suite?.id ?? null,
      testId: matchResult.test?.id ?? null,
      responseId: null,
      errorCode: matchResult.error.code,
      errorMessage: matchResult.error.message,
      durationMs,
    });
    return matchResult.response;
  }

  const metadata = createMessageMetadata();
  const responsePayload = formatResponse(
    model,
    matchResult.outputMessage,
    metadata
  );
  const outputPayload: Prisma.InputJsonValue = responsePayload;

  recordResponseLog({
    runId: runParams.data.runId,
    status: ResponseLogStatus.success,
    orgSlug,
    suiteName,
    model,
    clientTestName: runParams.data.clientTestName,
    input: inputPayload,
    stream: streamEnabled,
    suiteId: matchResult.suite.id,
    testId: matchResult.test.id,
    output: outputPayload,
    responseId: responsePayload.id,
    errorCode: null,
    errorMessage: null,
    durationMs,
  });

  if (streamEnabled) {
    const streamBody = formatSSEStream(
      model,
      matchResult.outputMessage,
      metadata
    );
    return new Response(streamBody, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  }

  return new Response(JSON.stringify(responsePayload), {
    headers: { "Content-Type": "application/json" },
  });
}
