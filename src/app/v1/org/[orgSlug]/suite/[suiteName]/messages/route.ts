import { NextRequest, NextResponse } from "next/server";
import {
  createMessageMetadata,
  formatResponse,
  formatSSEStream,
} from "@/lib/messages/formatting";
import { parseMessagesRequestBody } from "@/lib/messages/request";
import { resolveMessageMatch } from "@/lib/messages/resolve";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string; suiteName: string }> }
) {
  const { orgSlug, suiteName } = await params;

  const parsedRequest = await parseMessagesRequestBody(request);
  if (!parsedRequest.ok) return parsedRequest.error;

  const { model, system, messages, stream } = parsedRequest.data;
  const matchResult = await resolveMessageMatch({
    orgSlug,
    suiteName,
    model,
    system,
    messages,
  });
  if (!matchResult.ok) return matchResult.response;

  const metadata = createMessageMetadata();

  if (stream) {
    const streamBody = formatSSEStream(
      model,
      matchResult.outputMessage,
      metadata
    );
    return new Response(streamBody, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  }

  const response = formatResponse(
    model,
    matchResult.outputMessage,
    metadata
  );
  return NextResponse.json(response);
}
