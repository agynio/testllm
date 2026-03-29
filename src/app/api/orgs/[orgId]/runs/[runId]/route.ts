import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthWithMembership } from "@/lib/auth-helpers";
import { notFoundError } from "@/lib/errors";
import { parseRequestBody } from "@/lib/validation";

const UpdateRunSchema = z.object({
  name: z.string().min(1).optional(),
  commit_sha: z.string().min(1).optional(),
  branch: z.string().min(1).optional(),
});

type TestExecutionSummary = {
  clientTestName: string;
  callCount: number;
  suitesUsed: Set<string>;
  startedAt: Date;
  finishedAt: Date;
  hasError: boolean;
  firstError: { code: string | null; message: string | null } | null;
};

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

  const startedAt = logs[0]?.createdAt ?? null;
  const finishedAt = logs.length > 0 ? logs[logs.length - 1].createdAt : null;

  const summaries = new Map<string, TestExecutionSummary>();
  for (const log of logs) {
    const existing = summaries.get(log.clientTestName);
    if (!existing) {
      summaries.set(log.clientTestName, {
        clientTestName: log.clientTestName,
        callCount: 1,
        suitesUsed: new Set([log.suiteName]),
        startedAt: log.createdAt,
        finishedAt: log.createdAt,
        hasError: log.status === "error",
        firstError:
          log.status === "error"
            ? { code: log.errorCode, message: log.errorMessage }
            : null,
      });
      continue;
    }

    existing.callCount += 1;
    existing.suitesUsed.add(log.suiteName);
    existing.finishedAt = log.createdAt;
    if (log.status === "error" && !existing.hasError) {
      existing.hasError = true;
      existing.firstError = { code: log.errorCode, message: log.errorMessage };
    }
  }

  const executionList = Array.from(summaries.values()).sort((a, b) =>
    a.startedAt.getTime() - b.startedAt.getTime()
  );
  const testsTotal = summaries.size;
  const testsFailed = executionList.filter((item) => item.hasError).length;
  const testsPassed = testsTotal - testsFailed;

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
