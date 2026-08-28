import { describe, expect, it } from "vitest";
import { formatSSEStream, usageFor } from "@/lib/responses/formatting";
import type { OutputTestItem, SSEEvent } from "@/lib/responses/types";

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

function messageItem(text: string): OutputTestItem {
  return {
    id: "msg-1",
    position: 0,
    type: "message",
    content: { role: "assistant", content: text },
  };
}

function functionCallItem(args: string): OutputTestItem {
  return {
    id: "fc-1",
    position: 0,
    type: "function_call",
    content: { call_id: "call-1", name: "get_weather", arguments: args },
  };
}

describe("formatSSEStream", () => {
  it("formats message output into SSE events", async () => {
    const stream = formatSSEStream("simple", [messageItem("Hello there")]);
    const events = parseSSE(await readStream(stream));
    const eventTypes = events.map((event) => event.event);

    expect(eventTypes).toEqual([
      "response.created",
      "response.in_progress",
      "response.output_item.added",
      "response.content_part.added",
      "response.output_text.delta",
      "response.output_text.done",
      "response.content_part.done",
      "response.output_item.done",
      "response.completed",
    ]);

    events.forEach(({ event, data }) => {
      expect(data.type).toBe(event);
    });

    const addedItem = events[2].data as { item: { id: string; status: string } };
    const addedItemId = addedItem.item.id;
    expect(addedItem.item.status).toBe("in_progress");

    const deltaEvent = events[4].data as { delta: string; item_id: string };
    expect(deltaEvent.delta).toBe("Hello there");
    expect(deltaEvent.item_id).toBe(addedItemId);

    const completedEvent = events[8].data as {
      response: { output: Array<{ content: Array<{ text: string }> }> };
    };
    expect(completedEvent.response.output[0].content[0].text).toBe(
      "Hello there"
    );
  });

  it("formats function_call output into SSE events", async () => {
    const stream = formatSSEStream("weather", [
      functionCallItem("{\"city\":\"SF\"}"),
    ]);
    const events = parseSSE(await readStream(stream));
    const eventTypes = events.map((event) => event.event);

    expect(eventTypes).toEqual([
      "response.created",
      "response.in_progress",
      "response.output_item.added",
      "response.function_call_arguments.delta",
      "response.function_call_arguments.done",
      "response.output_item.done",
      "response.completed",
    ]);

    const addedItem = events[2].data as { item: { arguments: string } };
    expect(addedItem.item.arguments).toBe("");

    const deltaEvent = events[3].data as { delta: string };
    expect(deltaEvent.delta).toBe("{\"city\":\"SF\"}");

    const doneEvent = events[4].data as { arguments: string; name: string };
    expect(doneEvent.name).toBe("get_weather");
    expect(doneEvent.arguments).toBe("{\"city\":\"SF\"}");
  });

  it("assigns output_index values for multiple outputs", async () => {
    const stream = formatSSEStream("multi", [
      functionCallItem("{}"),
      messageItem("Done"),
    ]);
    const events = parseSSE(await readStream(stream));

    const addedIndexes = events
      .filter((event) => event.event === "response.output_item.added")
      .map((event) => (event.data as { output_index: number }).output_index);
    const doneIndexes = events
      .filter((event) => event.event === "response.output_item.done")
      .map((event) => (event.data as { output_index: number }).output_index);

    expect(addedIndexes).toEqual([0, 1]);
    expect(doneIndexes).toEqual([0, 1]);
  });

  it("emits monotonically increasing sequence numbers", async () => {
    const stream = formatSSEStream("sequence", [messageItem("Step")]);
    const events = parseSSE(await readStream(stream));
    const sequenceNumbers = events.map(
      (event) => (event.data as { sequence_number: number }).sequence_number
    );

    expect(sequenceNumbers).toEqual(
      Array.from({ length: events.length }, (_, index) => index)
    );
  });
});

describe("namespaced calls in the stream", () => {
  const call = (namespace?: string): OutputTestItem => ({
    id: "fc-1",
    position: 1,
    type: "function_call",
    content: {
      call_id: "fc_mem_001",
      name: "create_entities",
      arguments: "{}",
      ...(namespace ? { namespace } : {}),
    },
  });

  const streamedCallItems = async (item: OutputTestItem) => {
    const events = parseSSE(await readStream(formatSSEStream("model", [item])));
    return events
      .map((event) => (event.data as { item?: Record<string, unknown> }).item)
      .filter((streamed): streamed is Record<string, unknown> => Boolean(streamed))
      .filter((streamed) => streamed.type === "function_call");
  };

  // The stream is the only form the agent CLI reads, and it echoes a call back
  // the way it arrived. A namespace dropped here is a namespace missing from
  // the reply, and the call stops identifying the tool it named.
  it("carries the namespace on every streamed function_call item", async () => {
    const items = await streamedCallItems(call("mcp__memory"));
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.namespace).toBe("mcp__memory");
    }
  });

  it("leaves the field off a call that has no namespace", async () => {
    const items = await streamedCallItems(call());
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item).not.toHaveProperty("namespace");
    }
  });
});

describe("usage reporting", () => {
  const assistant = (text: string): OutputTestItem => ({
    id: "msg-1",
    position: 1,
    type: "message",
    content: { role: "assistant", content: text },
  });

  // What meters a turn cannot tell a scripted provider from a real one, so a
  // reply that reports nothing is a turn that never happened as far as usage
  // is concerned.
  it("reports tokens for both sides of a turn", async () => {
    const events = parseSSE(
      await readStream(formatSSEStream("model", [assistant("a reply worth counting")], undefined, {
        input_tokens: 12,
        output_tokens: 5,
        total_tokens: 17,
      })),
    );
    const completed = events.find((event) => event.event === "response.completed");
    expect((completed?.data as { response?: { usage?: unknown } }).response?.usage).toEqual({
      input_tokens: 12,
      output_tokens: 5,
      total_tokens: 17,
    });
  });

  it("counts something for a reply that has text", () => {
    const usage = usageFor("a question from the caller", [assistant("an answer of some length")]);
    expect(usage.input_tokens).toBeGreaterThan(0);
    expect(usage.output_tokens).toBeGreaterThan(0);
    expect(usage.total_tokens).toBe(usage.input_tokens + usage.output_tokens);
  });

  it("charges nothing for nothing", () => {
    expect(usageFor("", [])).toEqual({ input_tokens: 0, output_tokens: 0, total_tokens: 0 });
  });
});
