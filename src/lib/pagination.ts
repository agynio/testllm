import { z } from "zod";

const CursorSchema = z.string().uuid();

export function parseCursorParam(value: string | string[] | undefined) {
  const cursor = Array.isArray(value) ? value[0] : value;
  if (!cursor) return undefined;
  const parsed = CursorSchema.safeParse(cursor.trim());
  return parsed.success ? parsed.data : undefined;
}
