import Link from "next/link";
import { ResponseLogStatus } from "@prisma/client";
import { z } from "zod";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { RelativeTime } from "@/components/relative-time";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;
const CursorSchema = z.string().uuid();

type RunsSearchParams = {
  cursor?: string | string[];
};

type RunSummary = {
  tests: Map<string, { hasError: boolean }>;
  startedAt: Date | null;
  finishedAt: Date | null;
};

function formatDuration(durationMs: number) {
  if (durationMs < 1000) return `${durationMs}ms`;
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${remainingMinutes}m`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${totalSeconds}s`;
}

function parseCursorParam(searchParams?: RunsSearchParams) {
  const value = searchParams?.cursor;
  const cursor = Array.isArray(value) ? value[0] : value;
  if (!cursor) return undefined;
  const parsed = CursorSchema.safeParse(cursor.trim());
  return parsed.success ? parsed.data : undefined;
}

async function fetchRunPage(orgId: string, cursor?: string) {
  const runs = await prisma.testRun.findMany({
    where: { orgId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasNextPage = runs.length > PAGE_SIZE;
  const pageRuns = hasNextPage ? runs.slice(0, PAGE_SIZE) : runs;
  const nextCursor = hasNextPage
    ? pageRuns[pageRuns.length - 1]?.id ?? null
    : null;

  return { pageRuns, nextCursor };
}

async function loadRuns(orgId: string, cursorParam?: string) {
  const runs = [] as Awaited<ReturnType<typeof fetchRunPage>>["pageRuns"];
  let cursor: string | undefined;
  let nextCursor: string | null = null;

  while (true) {
    const page = await fetchRunPage(orgId, cursor);
    runs.push(...page.pageRuns);
    nextCursor = page.nextCursor;

    if (!cursorParam) break;
    if (cursor === cursorParam) break;
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }

  return { runs, nextCursor };
}

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

function buildRunsHref(orgId: string, cursor: string) {
  const params = new URLSearchParams({ cursor });
  return `/orgs/${orgId}/runs?${params.toString()}`;
}

export default async function RunsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams?: Promise<RunsSearchParams>;
}) {
  const { orgId } = await params;
  const resolvedSearchParams = await searchParams;
  const cursorParam = parseCursorParam(resolvedSearchParams);

  const { runs, nextCursor } = await loadRuns(orgId, cursorParam);
  const summaries = await buildRunSummaries(runs.map((run) => run.id));
  const placeholder = "\u2014";

  return (
    <div className="space-y-6">
      <PageHeader title="Runs" />

      {runs.length === 0 ? (
        <EmptyState
          title="No runs yet"
          description="Test runs will appear after your agent executes tests."
        />
      ) : (
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Results</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => {
                const summary = summaries.get(run.id);
                const testsTotal = summary?.tests.size ?? 0;
                const testsFailed = summary
                  ? Array.from(summary.tests.values()).filter(
                      (test) => test.hasError
                    ).length
                  : 0;
                const testsPassed = testsTotal - testsFailed;
                const startedAt = summary?.startedAt ?? null;
                const finishedAt = summary?.finishedAt ?? null;
                const durationMs =
                  startedAt && finishedAt
                    ? Math.max(0, finishedAt.getTime() - startedAt.getTime())
                    : null;
                const durationLabel =
                  durationMs !== null ? formatDuration(durationMs) : placeholder;
                const runHref = `/orgs/${orgId}/runs/${run.id}`;

                return (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={runHref}
                        className="block w-full text-foreground hover:underline"
                      >
                        {run.name ?? placeholder}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={runHref} className="block w-full">
                        {testsTotal === 0 ? (
                          <span className="text-sm text-muted-foreground">
                            {placeholder}
                          </span>
                        ) : (
                          <span className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="text-emerald-700 dark:text-emerald-200">
                              {testsPassed} passed
                            </span>
                            <span className="text-muted-foreground">
                              {"\u00b7"}
                            </span>
                            <span className="text-destructive">
                              {testsFailed} failed
                            </span>
                          </span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={runHref} className="block w-full">
                        {startedAt ? (
                          <RelativeTime value={startedAt} />
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {placeholder}
                          </span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={runHref} className="block w-full">
                        <span className="text-sm text-muted-foreground">
                          {durationLabel}
                        </span>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {nextCursor ? (
            <div className="flex justify-center">
              <Button variant="outline" asChild>
                <Link href={buildRunsHref(orgId, nextCursor)}>Load more</Link>
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
