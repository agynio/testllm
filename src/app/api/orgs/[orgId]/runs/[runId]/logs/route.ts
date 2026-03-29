import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthWithMembership } from "@/lib/auth-helpers";
import { notFoundError } from "@/lib/errors";
import { parseBody } from "@/lib/validation";

const ListLogsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z
    .preprocess(
      (value) => (value === undefined ? undefined : Number(value)),
      z.number().int().min(1).max(100)
    )
    .optional(),
  client_test_name: z.string().min(1).optional(),
  status: z.enum(["success", "error"]).optional(),
});

function parseListParams(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  return parseBody(ListLogsQuerySchema, {
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    client_test_name: searchParams.get("client_test_name") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });
}

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

  const parsedQuery = parseListParams(request);
  if (!parsedQuery.ok) return parsedQuery.error;

  const limit = parsedQuery.data.limit ?? 50;
  const cursor = parsedQuery.data.cursor;

  const logs = await prisma.responseLog.findMany({
    where: {
      runId,
      clientTestName: parsedQuery.data.client_test_name,
      status: parsedQuery.data.status,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasNextPage = logs.length > limit;
  const pageLogs = hasNextPage ? logs.slice(0, limit) : logs;
  const nextCursor = hasNextPage
    ? pageLogs[pageLogs.length - 1]?.id ?? null
    : null;

  return NextResponse.json({
    logs: pageLogs.map((log) => ({
      id: log.id,
      run_id: log.runId,
      status: log.status,
      org_slug: log.orgSlug,
      suite_name: log.suiteName,
      model: log.model,
      client_test_name: log.clientTestName,
      stream: log.stream,
      suite_id: log.suiteId,
      test_id: log.testId,
      response_id: log.responseId,
      error_code: log.errorCode,
      error_message: log.errorMessage,
      duration_ms: log.durationMs,
      created_at: log.createdAt.toISOString(),
    })),
    next_cursor: nextCursor,
  });
}
