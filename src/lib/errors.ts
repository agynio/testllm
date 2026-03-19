import { NextResponse } from "next/server";

interface ApiError {
  message: string;
  type: string;
  code: string;
}

export function errorResponse(status: number, error: ApiError): NextResponse {
  return NextResponse.json({ error }, { status });
}

// ── Management API errors ──

export function unauthorizedError(): NextResponse {
  return errorResponse(401, {
    message: "Unauthorized",
    type: "auth_error",
    code: "unauthorized",
  });
}

export function forbiddenError(): NextResponse {
  return errorResponse(403, {
    message: "Forbidden: insufficient permissions",
    type: "auth_error",
    code: "forbidden",
  });
}

export function notFoundError(resource: string): NextResponse {
  return errorResponse(404, {
    message: `${resource} not found`,
    type: "not_found_error",
    code: "not_found",
  });
}

export function conflictError(message: string): NextResponse {
  return errorResponse(409, {
    message,
    type: "conflict_error",
    code: "conflict",
  });
}

export function validationError(message: string): NextResponse {
  return errorResponse(400, {
    message,
    type: "validation_error",
    code: "invalid_request",
  });
}

// ── Responses API errors (OpenAI format) ──

export function openaiError(
  status: number,
  message: string,
  type: string,
  code: string
): NextResponse {
  return errorResponse(status, { message, type, code });
}
