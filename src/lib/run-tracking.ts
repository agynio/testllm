import type { Prisma, TestRun } from "@prisma/client";
import { Prisma as PrismaErrors } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const RunIdSchema = z.string().uuid();
const ClientTestNameSchema = z.string().min(1);

export type RunParams = {
  runId: string;
  clientTestName: string;
};

export type RunParamParseResult =
  | { ok: true; data: RunParams }
  | { ok: false; error: Response };

export type RunErrorCodes = {
  invalidRunId: string;
  invalidClientTestName: string;
  runNotFound: string;
};

export type RunErrorFormatter = (
  status: number,
  message: string,
  type: string,
  code: string
) => Response;

export function parseRunParams(
  runId: string,
  clientTestName: string,
  formatError: RunErrorFormatter,
  codes: RunErrorCodes
): RunParamParseResult {
  const runIdResult = RunIdSchema.safeParse(runId);
  if (!runIdResult.success) {
    return {
      ok: false,
      error: formatError(
        400,
        "runId must be a valid UUID",
        "invalid_request_error",
        codes.invalidRunId
      ),
    };
  }

  let decodedName: string;
  try {
    decodedName = decodeURIComponent(clientTestName);
  } catch {
    return {
      ok: false,
      error: formatError(
        400,
        "clientTestName must be URL encoded",
        "invalid_request_error",
        codes.invalidClientTestName
      ),
    };
  }

  const trimmedName = decodedName.trim();
  const nameResult = ClientTestNameSchema.safeParse(trimmedName);
  if (!nameResult.success) {
    return {
      ok: false,
      error: formatError(
        400,
        "clientTestName must be provided",
        "invalid_request_error",
        codes.invalidClientTestName
      ),
    };
  }

  return {
    ok: true,
    data: { runId: runIdResult.data, clientTestName: trimmedName },
  };
}

export async function ensureTestRun(
  runId: string,
  orgId: string,
  formatError: RunErrorFormatter,
  codes: RunErrorCodes
): Promise<{ ok: true; run: TestRun } | { ok: false; error: Response }> {
  try {
    const run = await prisma.testRun.create({
      data: { id: runId, orgId },
    });
    return { ok: true as const, run };
  } catch (error) {
    if (
      error instanceof PrismaErrors.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const run = await prisma.testRun.findUnique({ where: { id: runId } });
      if (run && run.orgId === orgId) {
        return { ok: true as const, run };
      }
      return {
        ok: false as const,
        error: formatError(
          404,
          `Test run '${runId}' not found`,
          "not_found_error",
          codes.runNotFound
        ),
      };
    }
    throw error;
  }
}

export function recordResponseLog(
  data: Prisma.ResponseLogCreateInput | Prisma.ResponseLogUncheckedCreateInput
) {
  void prisma.responseLog
    .create({ data })
    .catch((error) => console.error("Failed to record response log", error));
}
