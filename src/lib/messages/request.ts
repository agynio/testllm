import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { anthropicError } from "@/lib/errors";
import {
  MessagesSchema,
  SystemSchema,
} from "@/lib/messages/matching";

const RequestSchema = z
  .object({
    model: z.string().min(1, { message: "model is required" }),
    max_tokens: z.number().int().positive({ message: "max_tokens is required" }),
    system: SystemSchema.optional(),
    messages: MessagesSchema,
    stream: z.boolean().optional(),
  })
  .passthrough();

export type MessagesRequestBody = z.infer<typeof RequestSchema>;

type RequestParseResult =
  | { ok: true; data: MessagesRequestBody }
  | { ok: false; error: NextResponse };

export async function parseMessagesRequestBody(
  request: NextRequest
): Promise<RequestParseResult> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      error: anthropicError(400, "Invalid JSON body", "invalid_request_error"),
    };
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.join(".");

    const isMissing = (field: string) =>
      issue.code === "invalid_type" &&
      path === field &&
      (("received" in issue && issue.received === "undefined") ||
        issue.message.toLowerCase().includes("required") ||
        issue.message.includes("received undefined"));

    if (isMissing("model")) {
      return {
        ok: false,
        error: anthropicError(
          400,
          "Missing required field: model",
          "invalid_request_error"
        ),
      };
    }

    if (isMissing("max_tokens")) {
      return {
        ok: false,
        error: anthropicError(
          400,
          "Missing required field: max_tokens",
          "invalid_request_error"
        ),
      };
    }

    if (isMissing("messages")) {
      return {
        ok: false,
        error: anthropicError(
          400,
          "Missing required field: messages",
          "invalid_request_error"
        ),
      };
    }

    const prefix = issue.path.length > 0 ? `${path}: ` : "";
    return {
      ok: false,
      error: anthropicError(
        400,
        `${prefix}${issue.message}`,
        "invalid_request_error"
      ),
    };
  }

  return { ok: true, data: parsed.data };
}
