import { randomUUID } from "crypto";
import type {
  OpenAIOutputItem,
  OpenAIResponse,
  OpenAIResponseCompleted,
  OpenAIResponseInProgress,
  OutputTextContentPart,
  OutputTestItem,
  SSEEvent,
} from "@/lib/responses/types";

export type ResponseMetadata = {
  responseId: string;
  createdAt: number;
};

export function createResponseMetadata(): ResponseMetadata {
  return {
    responseId: `resp_${randomUUID()}`,
    createdAt: Math.floor(Date.now() / 1000),
  };
}

function outputTextPart(text: string): OutputTextContentPart {
  return {
    type: "output_text",
    text,
    annotations: [],
  };
}

export function formatOutputItem(item: OutputTestItem): OpenAIOutputItem {
  if (item.type === "message") {
    return {
      id: `msg_${randomUUID()}`,
      type: "message",
      role: "assistant",
      status: "completed",
      content: [outputTextPart(item.content.content)],
    };
  }

  return {
    id: `fc_${randomUUID()}`,
    type: "function_call",
    call_id: item.content.call_id,
    name: item.content.name,
    arguments: item.content.arguments,
    status: "completed",
  };
}

export function formatResponse(
  model: string,
  outputItems: OutputTestItem[],
  metadata: ResponseMetadata = createResponseMetadata()
): OpenAIResponse {
  return {
    id: metadata.responseId,
    object: "response",
    created_at: metadata.createdAt,
    model,
    output: outputItems.map(formatOutputItem),
    status: "completed",
  };
}

export function formatSSEStream(
  model: string,
  outputItems: OutputTestItem[],
  metadata: ResponseMetadata = createResponseMetadata()
): ReadableStream<Uint8Array> {
  const responseId = metadata.responseId;
  const createdAt = metadata.createdAt;
  const events: SSEEvent[] = [];
  const completedOutput: OpenAIOutputItem[] = [];
  let sequenceNumber = 0;

  const baseResponse: OpenAIResponseInProgress = {
    id: responseId,
    object: "response",
    created_at: createdAt,
    model,
    output: [],
    status: "in_progress",
    usage: null,
  };

  events.push({
    type: "response.created",
    response: baseResponse,
    sequence_number: sequenceNumber++,
  });
  events.push({
    type: "response.in_progress",
    response: baseResponse,
    sequence_number: sequenceNumber++,
  });

  outputItems.forEach((item, outputIndex) => {
    if (item.type === "message") {
      const itemId = `msg_${randomUUID()}`;
      const text = item.content.content;
      const addedItem: OpenAIOutputItem = {
        id: itemId,
        type: "message",
        role: "assistant",
        status: "in_progress",
        content: [],
      };

      events.push({
        type: "response.output_item.added",
        output_index: outputIndex,
        item: addedItem,
        sequence_number: sequenceNumber++,
      });

      events.push({
        type: "response.content_part.added",
        item_id: itemId,
        output_index: outputIndex,
        content_index: 0,
        part: outputTextPart(""),
        sequence_number: sequenceNumber++,
      });

      events.push({
        type: "response.output_text.delta",
        item_id: itemId,
        output_index: outputIndex,
        content_index: 0,
        delta: text,
        sequence_number: sequenceNumber++,
      });

      events.push({
        type: "response.output_text.done",
        item_id: itemId,
        output_index: outputIndex,
        content_index: 0,
        text,
        sequence_number: sequenceNumber++,
      });

      const completedPart = outputTextPart(text);
      events.push({
        type: "response.content_part.done",
        item_id: itemId,
        output_index: outputIndex,
        content_index: 0,
        part: completedPart,
        sequence_number: sequenceNumber++,
      });

      const completedItem: OpenAIOutputItem = {
        id: itemId,
        type: "message",
        role: "assistant",
        status: "completed",
        content: [completedPart],
      };

      events.push({
        type: "response.output_item.done",
        output_index: outputIndex,
        item: completedItem,
        sequence_number: sequenceNumber++,
      });

      completedOutput.push(completedItem);
      return;
    }

    const itemId = `fc_${randomUUID()}`;
    const addedItem: OpenAIOutputItem = {
      id: itemId,
      type: "function_call",
      call_id: item.content.call_id,
      name: item.content.name,
      arguments: "",
      status: "in_progress",
    };

    events.push({
      type: "response.output_item.added",
      output_index: outputIndex,
      item: addedItem,
      sequence_number: sequenceNumber++,
    });

    events.push({
      type: "response.function_call_arguments.delta",
      item_id: itemId,
      output_index: outputIndex,
      delta: item.content.arguments,
      sequence_number: sequenceNumber++,
    });

    events.push({
      type: "response.function_call_arguments.done",
      item_id: itemId,
      output_index: outputIndex,
      name: item.content.name,
      arguments: item.content.arguments,
      sequence_number: sequenceNumber++,
    });

    const completedItem: OpenAIOutputItem = {
      id: itemId,
      type: "function_call",
      call_id: item.content.call_id,
      name: item.content.name,
      arguments: item.content.arguments,
      status: "completed",
    };

    events.push({
      type: "response.output_item.done",
      output_index: outputIndex,
      item: completedItem,
      sequence_number: sequenceNumber++,
    });

    completedOutput.push(completedItem);
  });

  const completedResponse: OpenAIResponseCompleted = {
    id: responseId,
    object: "response",
    created_at: createdAt,
    model,
    output: completedOutput,
    status: "completed",
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    },
  };

  events.push({
    type: "response.completed",
    response: completedResponse,
    sequence_number: sequenceNumber++,
  });

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
