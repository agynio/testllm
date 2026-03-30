import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthWithMembership } from "@/lib/auth-helpers";
import { notFoundError } from "@/lib/errors";
import { buildTestExecutionSummaries } from "@/lib/run-helpers";
import { parseRequestBody } from "@/lib/validation";

const UpdateRunSchema = z.object({
  name: z.string().min(1).optional(),
  commit_sha: z.string().min(1).optional(),
  branch: z.string().min(1).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; runId: string }> }
) {
  const { orgId, runId } = await params;

  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const run = await prisma.testRun.findUnique({ where: { id: runId } });
  if (!run || run.orgId !== orgId) {
    return notFoundError("Test run");
  }

  const logs = await prisma.responseLog.findMany({
    where: { runId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      clientTestName: true,
      status: true,
      suiteName: true,
      errorCode: true,
      errorMessage: true,
      createdAt: true,
    },
  });
  const {
    executionList,
    testsTotal,
    testsFailed,
    testsPassed,
    startedAt,
    finishedAt,
  } = buildTestExecutionSummaries(logs);

  return NextResponse.json({
    id: run.id,
    org_id: run.orgId,
    name: run.name,
    commit_sha: run.commitSha,
    branch: run.branch,
    created_at: run.createdAt.toISOString(),
    tests_total: testsTotal,
    tests_passed: testsPassed,
    tests_failed: testsFailed,
    started_at: startedAt?.toISOString() ?? null,
    finished_at: finishedAt?.toISOString() ?? null,
    test_executions: executionList.map((item) => ({
      client_test_name: item.clientTestName,
      status: item.hasError ? "failed" : "passed",
      call_count: item.callCount,
      suites_used: Array.from(item.suitesUsed),
      first_error: item.firstError,
      started_at: item.startedAt.toISOString(),
      finished_at: item.finishedAt.toISOString(),
    })),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; runId: string }> }
) {
  const { orgId, runId } = await params;

  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const parsed = await parseRequestBody(request, UpdateRunSchema);
  if (!parsed.ok) return parsed.error;

  const run = await prisma.testRun.findUnique({ where: { id: runId } });
  if (!run || run.orgId !== orgId) {
    return notFoundError("Test run");
  }

  const updated = await prisma.testRun.update({
    where: { id: runId },
    data: {
      name: parsed.data.name,
      commitSha: parsed.data.commit_sha,
      branch: parsed.data.branch,
    },
  });

  return NextResponse.json({
    id: updated.id,
    org_id: updated.orgId,
    name: updated.name,
    commit_sha: updated.commitSha,
    branch: updated.branch,
    created_at: updated.createdAt.toISOString(),
  });
}
