import Link from "next/link";
import { notFound } from "next/navigation";
import { ResponseLogStatus } from "@prisma/client";
import { Check, ChevronLeft, X } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
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

type TestExecutionSummary = {
  clientTestName: string;
  callCount: number;
  suitesUsed: Set<string>;
  startedAt: Date;
  finishedAt: Date;
  hasError: boolean;
  firstError: { code: string | null; message: string | null } | null;
};

function formatCommitSha(commitSha: string) {
  return commitSha.length > 7 ? commitSha.slice(0, 7) : commitSha;
}

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; runId: string }>;
}) {
  const { orgId, runId } = await params;

  const run = await prisma.testRun.findUnique({ where: { id: runId } });
  if (!run || run.orgId !== orgId) {
    notFound();
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
  const testsTotal = executionList.length;
  const testsFailed = executionList.filter((item) => item.hasError).length;
  const testsPassed = testsTotal - testsFailed;
  const placeholder = "\u2014";

  const metadataParts = [] as string[];
  if (run.branch) metadataParts.push(`Branch: ${run.branch}`);
  if (run.commitSha) {
    metadataParts.push(`Commit: ${formatCommitSha(run.commitSha)}`);
  }
  const description = metadataParts.length
    ? metadataParts.join(" \u00b7 ")
    : undefined;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/orgs/${orgId}/runs`} className="flex items-center gap-2">
          <ChevronLeft className="size-4" />
          Back to Runs
        </Link>
      </Button>

      <div className="space-y-3">
        <PageHeader
          title={run.name ?? "Unnamed Run"}
          description={description}
        />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-emerald-700 dark:text-emerald-200">
            {testsPassed} passed
          </span>
          <span className="text-muted-foreground">{"\u00b7"}</span>
          <span className="text-destructive">{testsFailed} failed</span>
          <span className="text-muted-foreground">{"\u00b7"}</span>
          <span className="text-muted-foreground">{testsTotal} total</span>
        </div>
      </div>

      {executionList.length === 0 ? (
        <EmptyState
          title="No executions yet"
          description="This run does not have any logged test executions."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Client Test</TableHead>
              <TableHead>Suites</TableHead>
              <TableHead>Calls</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {executionList.map((execution) => {
              const rowHref = `/orgs/${orgId}/runs/${runId}/logs?client_test_name=${encodeURIComponent(
                execution.clientTestName
              )}`;
              const suitesUsed = Array.from(execution.suitesUsed).sort();
              const suitesLabel = suitesUsed.length
                ? suitesUsed.join(", ")
                : placeholder;
              const errorText =
                execution.firstError?.message ??
                execution.firstError?.code ??
                placeholder;

              return (
                <TableRow key={execution.clientTestName}>
                  <TableCell>
                    <Link href={rowHref} className="block w-full">
                      {execution.hasError ? (
                        <Badge variant="destructive" className="gap-1">
                          <X className="size-3" />
                          Failed
                        </Badge>
                      ) : (
                        <Badge variant="default" className="gap-1">
                          <Check className="size-3" />
                          Passed
                        </Badge>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono">
                    <Link href={rowHref} className="block w-full">
                      {execution.clientTestName}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate text-muted-foreground">
                    <Link href={rowHref} className="block w-full">
                      {suitesLabel}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={rowHref} className="block w-full">
                      {execution.callCount}
                    </Link>
                  </TableCell>
                  <TableCell
                    className={`max-w-[320px] truncate ${
                      execution.hasError
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    <Link href={rowHref} className="block w-full">
                      {errorText}
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
