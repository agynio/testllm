import { NextRequest, NextResponse } from "next/server";
import {
  createResponseMetadata,
  formatResponse,
  formatSSEStream,
} from "@/lib/responses/formatting";
import { parseResponsesRequestBody } from "@/lib/responses/request";
import { resolveResponseMatch } from "@/lib/responses/resolve";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string; suiteName: string }> }
) {
  const { orgSlug, suiteName } = await params;

  const parsedRequest = await parseResponsesRequestBody(request);
  if (!parsedRequest.ok) return parsedRequest.error;

  const { model, input, stream } = parsedRequest.data;
  const matchResult = await resolveResponseMatch({
    orgSlug,
    suiteName,
    model,
    input,
  });
  if (!matchResult.ok) return matchResult.response;

  const metadata = createResponseMetadata();

  if (stream) {
    const streamBody = formatSSEStream(model, matchResult.outputItems, metadata);
    return new Response(streamBody, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  }

  const response = formatResponse(model, matchResult.outputItems, metadata);
  return NextResponse.json(response);
}
