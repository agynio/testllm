import { NextRequest, NextResponse } from "next/server";
import { ResponseLogStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthWithMembership } from "@/lib/auth-helpers";
import { parseBody } from "@/lib/validation";

const ListRunsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z
    .preprocess(
      (value) => (value === undefined ? undefined : Number(value)),
      z.number().int().min(1).max(100)
    )
    .optional(),
});

type RunSummary = {
  tests: Map<string, { hasError: boolean }>;
  startedAt: Date | null;
  finishedAt: Date | null;
};

async function buildRunSummaries(runIds: string[]) {
  const summaries = new Map<string, RunSummary>();
  if (runIds.length === 0) return summaries;

  const groups = await prisma.responseLog.groupBy({
    by: ["runId", "clientTestName", "status"],
    where: { runId: { in: runIds } },
    _min: { createdAt: true },
    _max: { createdAt: true },
  });

  for (const group of groups) {
    const startedAt = group._min.createdAt;
    const finishedAt = group._max.createdAt;
    if (!startedAt || !finishedAt) {
      throw new Error("Response log timestamps missing from summary");
    }

    const summary = summaries.get(group.runId) ?? {
      tests: new Map(),
      startedAt: null,
      finishedAt: null,
    };

    const testSummary = summary.tests.get(group.clientTestName) ?? {
      hasError: false,
    };
    if (group.status === ResponseLogStatus.error) {
      testSummary.hasError = true;
    }
    summary.tests.set(group.clientTestName, testSummary);

    if (!summary.startedAt || startedAt < summary.startedAt) {
      summary.startedAt = startedAt;
    }
    if (!summary.finishedAt || finishedAt > summary.finishedAt) {
      summary.finishedAt = finishedAt;
    }

    summaries.set(group.runId, summary);
  }

  return summaries;
}

function parseListParams(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  return parseBody(ListRunsQuerySchema, {
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const parsedQuery = parseListParams(request);
  if (!parsedQuery.ok) return parsedQuery.error;

  const limit = parsedQuery.data.limit ?? 20;
  const cursor = parsedQuery.data.cursor;

  const runs = await prisma.testRun.findMany({
    where: { orgId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasNextPage = runs.length > limit;
  const pageRuns = hasNextPage ? runs.slice(0, limit) : runs;
  const nextCursor = hasNextPage
    ? pageRuns[pageRuns.length - 1]?.id ?? null
    : null;

  const summaries = await buildRunSummaries(pageRuns.map((run) => run.id));

  const responseRuns = pageRuns.map((run) => {
    const summary = summaries.get(run.id);
    const testsTotal = summary?.tests.size ?? 0;
    const testsFailed = summary
      ? Array.from(summary.tests.values()).filter((test) => test.hasError)
          .length
      : 0;
    const testsPassed = testsTotal - testsFailed;

    return {
      id: run.id,
      org_id: run.orgId,
      name: run.name,
      commit_sha: run.commitSha,
      branch: run.branch,
      created_at: run.createdAt.toISOString(),
      tests_total: testsTotal,
      tests_passed: testsPassed,
      tests_failed: testsFailed,
      started_at: summary?.startedAt?.toISOString() ?? null,
      finished_at: summary?.finishedAt?.toISOString() ?? null,
    };
  });

  return NextResponse.json({ runs: responseRuns, next_cursor: nextCursor });
}
