import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthWithMembership } from "@/lib/auth-helpers";
import { notFoundError } from "@/lib/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; runId: string; logId: string }> }
) {
  const { orgId, runId, logId } = await params;

  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const run = await prisma.testRun.findUnique({ where: { id: runId } });
  if (!run || run.orgId !== orgId) {
    return notFoundError("Test run");
  }

  const log = await prisma.responseLog.findFirst({
    where: { id: logId, runId },
  });
  if (!log) {
    return notFoundError("Response log");
  }

  return NextResponse.json({
    id: log.id,
    run_id: log.runId,
    status: log.status,
    org_slug: log.orgSlug,
    suite_name: log.suiteName,
    model: log.model,
    client_test_name: log.clientTestName,
    input: log.input,
    stream: log.stream,
    suite_id: log.suiteId,
    test_id: log.testId,
    output: log.output,
    response_id: log.responseId,
    error_code: log.errorCode,
    error_message: log.errorMessage,
    duration_ms: log.durationMs,
    created_at: log.createdAt.toISOString(),
  });
}
