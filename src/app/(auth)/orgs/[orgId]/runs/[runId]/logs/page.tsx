import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { RelativeTime } from "@/components/relative-time";
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
import { parseCursorParam } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 50;

type LogsSearchParams = {
  cursor?: string | string[];
  client_test_name?: string | string[];
};

function parseClientTestName(searchParams?: LogsSearchParams) {
  const value = searchParams?.client_test_name;
  const clientTestName = Array.isArray(value) ? value[0] : value;
  if (!clientTestName) return undefined;
  const trimmed = clientTestName.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function fetchLogsPage(
  runId: string,
  clientTestName: string | undefined,
  cursor?: string
) {
  const logs = await prisma.responseLog.findMany({
    where: { runId, clientTestName },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasNextPage = logs.length > PAGE_SIZE;
  const pageLogs = hasNextPage ? logs.slice(0, PAGE_SIZE) : logs;
  const nextCursor = hasNextPage
    ? pageLogs[pageLogs.length - 1]?.id ?? null
    : null;

  return { pageLogs, nextCursor };
}

function buildLogsHref(
  orgId: string,
  runId: string,
  cursor: string,
  clientTestName?: string
) {
  const params = new URLSearchParams({ cursor });
  if (clientTestName) {
    params.set("client_test_name", clientTestName);
  }
  return `/orgs/${orgId}/runs/${runId}/logs?${params.toString()}`;
}

export default async function RunLogsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; runId: string }>;
  searchParams?: Promise<LogsSearchParams>;
}) {
  const { orgId, runId } = await params;
  const resolvedSearchParams = await searchParams;
  const cursorParam = parseCursorParam(resolvedSearchParams?.cursor);
  const clientTestName = parseClientTestName(resolvedSearchParams);

  const run = await prisma.testRun.findUnique({ where: { id: runId } });
  if (!run || run.orgId !== orgId) {
    notFound();
  }

  const { pageLogs: logs, nextCursor } = await fetchLogsPage(
    runId,
    clientTestName,
    cursorParam
  );
  const placeholder = "\u2014";
  const showClientTest = !clientTestName;
  const title = clientTestName ? `Logs for ${clientTestName}` : "Logs";

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link
          href={`/orgs/${orgId}/runs/${runId}`}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="size-4" />
          Back to Run
        </Link>
      </Button>

      <PageHeader title={title} />

      {logs.length === 0 ? (
        <EmptyState
          title="No logs yet"
          description="Response logs will appear once this run executes tests."
        />
      ) : (
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Suite</TableHead>
                <TableHead>Model</TableHead>
                {showClientTest ? <TableHead>Client Test</TableHead> : null}
                <TableHead>Error</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const rowParams = new URLSearchParams();
                if (clientTestName) {
                  rowParams.set("client_test_name", clientTestName);
                }
                const rowHref = rowParams.toString()
                  ? `/orgs/${orgId}/runs/${runId}/logs/${log.id}?${rowParams.toString()}`
                  : `/orgs/${orgId}/runs/${runId}/logs/${log.id}`;
                return (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Link href={rowHref} className="block w-full">
                        <Badge
                          variant={
                            log.status === "error"
                              ? "destructive"
                              : "default"
                          }
                        >
                          {log.status === "error" ? "Error" : "Success"}
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono">
                      <Link href={rowHref} className="block w-full">
                        {log.suiteName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={rowHref} className="block w-full">
                        {log.model}
                      </Link>
                    </TableCell>
                    {showClientTest ? (
                      <TableCell className="font-mono">
                        <Link href={rowHref} className="block w-full">
                          {log.clientTestName}
                        </Link>
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <Link href={rowHref} className="block w-full">
                        <span className="text-sm text-muted-foreground">
                          {log.errorCode ?? placeholder}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={rowHref} className="block w-full">
                        <span className="text-sm text-muted-foreground">
                          {log.durationMs} ms
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={rowHref} className="block w-full">
                        <RelativeTime value={log.createdAt} />
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
                <Link
                  href={buildLogsHref(
                    orgId,
                    runId,
                    nextCursor,
                    clientTestName
                  )}
                >
                  Load more
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
