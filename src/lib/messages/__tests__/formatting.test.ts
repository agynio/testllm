import { describe, expect, it } from "vitest";
import {
  formatResponse,
  formatSSEStream,
} from "@/lib/messages/formatting";
import type { ContentBlock, OutputMessage, SSEEvent } from "@/lib/messages/types";

async function readStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    output += decoder.decode(value, { stream: true });
  }

  output += decoder.decode();
  return output;
}

function parseSSE(text: string) {
  return text
    .trim()
    .split("\n\n")
    .filter(Boolean)
    .map((chunk) => {
      const lines = chunk.split("\n");
      const eventLine = lines.find((line) => line.startsWith("event: "));
      const dataLine = lines.find((line) => line.startsWith("data: "));

      if (!eventLine || !dataLine) {
        throw new Error("Invalid SSE frame");
      }

      const event = eventLine.slice("event: ".length);
      const data = JSON.parse(dataLine.slice("data: ".length)) as SSEEvent;
      return { event, data };
    });
}

function outputMessage(content: ContentBlock[]): OutputMessage {
  return { role: "assistant", content };
}

describe("formatResponse", () => {
  it("sets stop_reason to end_turn for text-only responses", () => {
    const response = formatResponse(
      "model",
      outputMessage([{ type: "text", text: "Hello" }])
    );

    expect(response.stop_reason).toBe("end_turn");
    expect(response.content).toEqual([{ type: "text", text: "Hello" }]);
  });

  it("sets stop_reason to tool_use when tool blocks are present", () => {
    const response = formatResponse(
      "model",
      outputMessage([
        {
          type: "tool_use",
          id: "toolu_1",
          name: "get_weather",
          input: { city: "SF" },
        },
      ])
    );

    expect(response.stop_reason).toBe("tool_use");
  });
});

describe("formatSSEStream", () => {
  it("formats text blocks into SSE events", async () => {
    const stream = formatSSEStream(
      "model",
      outputMessage([{ type: "text", text: "Hello" }])
    );
    const events = parseSSE(await readStream(stream));
    const eventTypes = events.map((event) => event.event);

    expect(eventTypes).toEqual([
      "message_start",
      "content_block_start",
      "content_block_delta",
      "content_block_stop",
      "message_delta",
      "message_stop",
    ]);

    events.forEach(({ event, data }) => {
      expect(data.type).toBe(event);
    });

    const deltaEvent = events[2].data as {
      delta: { type: string; text: string };
    };
    expect(deltaEvent.delta.type).toBe("text_delta");
    expect(deltaEvent.delta.text).toBe("Hello");
  });

  it("formats tool_use blocks into input_json_delta events", async () => {
    const stream = formatSSEStream(
      "model",
      outputMessage([
        {
          type: "tool_use",
          id: "toolu_2",
          name: "lookup",
          input: { city: "SF" },
        },
      ])
    );

    const events = parseSSE(await readStream(stream));
    const deltaEvent = events[2].data as {
      delta: { type: string; partial_json: string };
    };

    expect(deltaEvent.delta.type).toBe("input_json_delta");
    expect(deltaEvent.delta.partial_json).toBe("{\"city\":\"SF\"}");
  });
});
