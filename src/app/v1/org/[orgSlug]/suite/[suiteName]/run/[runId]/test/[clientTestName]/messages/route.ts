import { NextRequest } from "next/server";
import { Prisma, ResponseLogStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { anthropicError } from "@/lib/errors";
import {
  createMessageMetadata,
  formatResponse,
  formatSSEStream,
} from "@/lib/messages/formatting";
import { parseMessagesRequestBody } from "@/lib/messages/request";
import { resolveMessageMatch } from "@/lib/messages/resolve";
import {
  ensureTestRun,
  parseRunParams,
  recordResponseLog,
} from "@/lib/run-tracking";

const runErrorCodes = {
  invalidRunId: "invalid_run_id",
  invalidClientTestName: "invalid_client_test_name",
  runNotFound: "run_not_found",
};

const formatRunError = (
  status: number,
  message: string,
  type: string,
  _code: string
) => {
  void _code;
  return anthropicError(status, message, type);
};

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

  const runParams = parseRunParams(
    runId,
    clientTestName,
    formatRunError,
    runErrorCodes
  );
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

  const runResult = await ensureTestRun(
    runParams.data.runId,
    org.id,
    formatRunError,
    runErrorCodes
  );
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
