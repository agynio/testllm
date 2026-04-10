import { NextRequest, NextResponse } from "next/server";
import { Prisma, ResponseLogStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { openaiError } from "@/lib/errors";
import {
  createResponseMetadata,
  formatResponse,
  formatSSEStream,
} from "@/lib/responses/formatting";
import { parseResponsesRequestBody } from "@/lib/responses/request";
import { resolveResponseMatch } from "@/lib/responses/resolve";
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
  code: string
) => openaiError(status, message, type, code);

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

  const parsedRequest = await parseResponsesRequestBody(request);
  if (!parsedRequest.ok) return parsedRequest.error;

  const { model, input, stream } = parsedRequest.data;
  const streamEnabled = stream === true;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) {
    return openaiError(
      404,
      `Organization '${orgSlug}' not found`,
      "not_found_error",
      "org_not_found"
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
  const matchResult = await resolveResponseMatch({
    orgSlug,
    suiteName,
    model,
    input,
    org,
  });
  const durationMs = Date.now() - startedAt;

  if (!matchResult.ok) {
    recordResponseLog({
      runId: runParams.data.runId,
      status: ResponseLogStatus.error,
      orgSlug,
      suiteName,
      model,
      clientTestName: runParams.data.clientTestName,
      input,
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

  const metadata = createResponseMetadata();
  const responsePayload = formatResponse(
    model,
    matchResult.outputItems,
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
    input,
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
      matchResult.outputItems,
      metadata
    );
    return new Response(streamBody, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  }

  return NextResponse.json(responsePayload);
}
