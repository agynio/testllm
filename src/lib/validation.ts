import { z } from "zod";
import { NextResponse } from "next/server";
import { validationError } from "@/lib/errors";

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: NextResponse };

export function parseBody<T>(
  schema: z.ZodType<T>,
  data: unknown
): ParseResult<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const path =
      firstIssue.path.length > 0 ? `${firstIssue.path.join(".")}: ` : "";
    return {
      ok: false,
      error: validationError(`${path}${firstIssue.message}`),
    };
  }
  return { ok: true, data: result.data };
}

export async function parseRequestBody<T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<ParseResult<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      error: validationError("Invalid JSON body"),
    };
  }

  return parseBody(schema, body);
}
