import { ResponseLogStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type RunTestSummary = {
  hasError: boolean;
};

export type RunSummary = {
  tests: Map<string, RunTestSummary>;
  startedAt: Date | null;
  finishedAt: Date | null;
};

export async function buildRunSummaries(runIds: string[]) {
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

export type TestExecutionLog = {
  clientTestName: string;
  status: ResponseLogStatus;
  suiteName: string;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
};

export type TestExecutionSummary = {
  clientTestName: string;
  callCount: number;
  suitesUsed: Set<string>;
  startedAt: Date;
  finishedAt: Date;
  hasError: boolean;
  firstError: { code: string | null; message: string | null } | null;
};

export function buildTestExecutionSummaries(logs: TestExecutionLog[]) {
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
        hasError: log.status === ResponseLogStatus.error,
        firstError:
          log.status === ResponseLogStatus.error
            ? { code: log.errorCode, message: log.errorMessage }
            : null,
      });
      continue;
    }

    existing.callCount += 1;
    existing.suitesUsed.add(log.suiteName);
    existing.finishedAt = log.createdAt;
    if (log.status === ResponseLogStatus.error && !existing.hasError) {
      existing.hasError = true;
      existing.firstError = { code: log.errorCode, message: log.errorMessage };
    }
  }

  const executionList = Array.from(summaries.values()).sort(
    (a, b) => a.startedAt.getTime() - b.startedAt.getTime()
  );
  const testsTotal = summaries.size;
  const testsFailed = executionList.filter((item) => item.hasError).length;
  const testsPassed = testsTotal - testsFailed;
  const startedAt = logs[0]?.createdAt ?? null;
  const finishedAt = logs.length > 0 ? logs[logs.length - 1].createdAt : null;

  return {
    executionList,
    testsTotal,
    testsFailed,
    testsPassed,
    startedAt,
    finishedAt,
  };
}
