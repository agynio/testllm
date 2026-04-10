import { randomUUID } from "crypto";
import type {
  AnthropicMessageResponse,
  AnthropicMessageStart,
  ContentBlock,
  InputJsonDelta,
  OutputMessage,
  SSEEvent,
  StopReason,
  TextDelta,
} from "@/lib/messages/types";

export type MessageMetadata = {
  messageId: string;
};

export function createMessageMetadata(): MessageMetadata {
  return { messageId: `msg_${randomUUID()}` };
}

function stopReasonFor(content: ContentBlock[]): StopReason {
  return content.some((block) => block.type === "tool_use")
    ? "tool_use"
    : "end_turn";
}

function assertNever(value: never, message: string): never {
  throw new Error(message);
}

export function formatResponse(
  model: string,
  outputMessage: OutputMessage,
  metadata: MessageMetadata = createMessageMetadata()
): AnthropicMessageResponse {
  const content = outputMessage.content;

  return {
    id: metadata.messageId,
    type: "message",
    role: "assistant",
    model,
    content,
    stop_reason: stopReasonFor(content),
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0 },
  };
}

function initialContentBlock(block: ContentBlock): ContentBlock {
  switch (block.type) {
    case "text":
      return { type: "text", text: "" };
    case "tool_use":
      return {
        type: "tool_use",
        id: block.id,
        name: block.name,
        input: {},
      };
    case "tool_result":
      return assertNever(
        block as never,
        "Tool result blocks are not valid in assistant output"
      );
    default:
      return assertNever(block as never, "Unexpected content block type");
  }
}

function blockDelta(block: ContentBlock): TextDelta | InputJsonDelta {
  switch (block.type) {
    case "text":
      return { type: "text_delta", text: block.text };
    case "tool_use":
      return {
        type: "input_json_delta",
        partial_json: JSON.stringify(block.input),
      };
    case "tool_result":
      return assertNever(
        block as never,
        "Tool result blocks are not valid in assistant output"
      );
    default:
      return assertNever(block as never, "Unexpected content block type");
  }
}

export function formatSSEStream(
  model: string,
  outputMessage: OutputMessage,
  metadata: MessageMetadata = createMessageMetadata()
): ReadableStream<Uint8Array> {
  const content = outputMessage.content;
  const stopReason = stopReasonFor(content);

  const startMessage: AnthropicMessageStart = {
    id: metadata.messageId,
    type: "message",
    role: "assistant",
    model,
    content: [],
    stop_reason: null,
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0 },
  };

  const events: SSEEvent[] = [
    { type: "message_start", message: startMessage },
  ];

  content.forEach((block, index) => {
    events.push({
      type: "content_block_start",
      index,
      content_block: initialContentBlock(block),
    });

    events.push({
      type: "content_block_delta",
      index,
      delta: blockDelta(block),
    });

    events.push({ type: "content_block_stop", index });
  });

  events.push({
    type: "message_delta",
    delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { output_tokens: 0 },
  });
  events.push({ type: "message_stop" });

  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const event of events) {
        const payload =
          `event: ${event.type}\n` +
          `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      }
      controller.close();
    },
  });
}
