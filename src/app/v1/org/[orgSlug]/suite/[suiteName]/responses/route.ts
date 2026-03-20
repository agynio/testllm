import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { openaiError } from "@/lib/errors";
import {
  InputSchema,
  isMatchError,
  matchInput,
  normalizeInput,
  parseTestSequence,
} from "@/lib/responses/matching";
import { formatResponse } from "@/lib/responses/formatting";

const RequestSchema = z
  .object({
    model: z.string().min(1, { message: "model is required" }),
    input: InputSchema,
  })
  .passthrough();

type RequestBody = z.infer<typeof RequestSchema>;

type RequestParseResult =
  | { ok: true; data: RequestBody }
  | { ok: false; error: NextResponse };

async function parseRequestBody(
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

  if (body && typeof body === "object" && !Array.isArray(body)) {
    const record = body as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(record, "model")) {
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
    if (!Object.prototype.hasOwnProperty.call(record, "input")) {
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
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.join(".");
    const receivedValue = "received" in issue ? issue.received : undefined;
    const isMissingField =
      issue.code === "invalid_type" &&
      path.length > 0 &&
      (receivedValue === "undefined" || receivedValue === undefined);

    if (isMissingField && path === "model") {
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
    if (isMissingField && path === "input") {
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string; suiteName: string }> }
) {
  const { orgSlug, suiteName } = await params;

  const parsedRequest = await parseRequestBody(request);
  if (!parsedRequest.ok) return parsedRequest.error;

  const { model, input } = parsedRequest.data;
  const normalizedInput = normalizeInput(input);

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) {
    return openaiError(
      404,
      `Organization '${orgSlug}' not found`,
      "not_found_error",
      "org_not_found"
    );
  }

  const suite = await prisma.testSuite.findUnique({
    where: { orgId_name: { orgId: org.id, name: suiteName } },
  });
  if (!suite) {
    return openaiError(
      404,
      `Test suite '${suiteName}' not found in organization '${orgSlug}'`,
      "not_found_error",
      "suite_not_found"
    );
  }

  const test = await prisma.test.findUnique({
    where: { testSuiteId_name: { testSuiteId: suite.id, name: model } },
  });
  if (!test) {
    return openaiError(
      404,
      `Model '${model}' not found in suite '${suiteName}'`,
      "not_found_error",
      "model_not_found"
    );
  }

  const rawSequence = await prisma.testItem.findMany({
    where: { testId: test.id },
    orderBy: { position: "asc" },
  });
  const sequence = parseTestSequence(rawSequence);

  const result = matchInput(sequence, normalizedInput);
  if (isMatchError(result)) {
    return openaiError(result.status, result.message, result.type, result.code);
  }

  const response = formatResponse(model, result.outputItems);
  return NextResponse.json(response);
}
