import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { openaiError } from "@/lib/errors";
import { InputSchema } from "@/lib/responses/matching";

const RequestSchema = z
  .object({
    model: z.string().min(1, { message: "model is required" }),
    input: InputSchema,
    stream: z.boolean().optional(),
  })
  .passthrough();

export type ResponsesRequestBody = z.infer<typeof RequestSchema>;

type RequestParseResult =
  | { ok: true; data: ResponsesRequestBody }
  | { ok: false; error: NextResponse };

export async function parseResponsesRequestBody(
  request: NextRequest
): Promise<RequestParseResult> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      error: openaiError(
        400,
        "Invalid JSON body",
        "invalid_request_error",
        "invalid_json"
      ),
    };
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.join(".");

    const isMissingModel =
      issue.code === "invalid_type" &&
      path === "model" &&
      issue.message.includes("received undefined");
    const isMissingInput =
      issue.code === "invalid_union" &&
      path === "input" &&
      issue.errors.length > 0 &&
      issue.errors.every((unionIssues) =>
        unionIssues.some(
          (unionIssue) =>
            unionIssue.code === "invalid_type" &&
            unionIssue.message.includes("received undefined")
        )
      );

    if (isMissingModel) {
      return {
        ok: false,
        error: openaiError(
          400,
          "Missing required field: model",
          "invalid_request_error",
          "missing_model"
        ),
      };
    }
    if (isMissingInput) {
      return {
        ok: false,
        error: openaiError(
          400,
          "Missing required field: input",
          "invalid_request_error",
          "missing_input"
        ),
      };
    }

    const prefix = issue.path.length > 0 ? `${path}: ` : "";
    return {
      ok: false,
      error: openaiError(
        400,
        `${prefix}${issue.message}`,
        "invalid_request_error",
        "invalid_request"
      ),
    };
  }

  return { ok: true, data: parsed.data };
}
