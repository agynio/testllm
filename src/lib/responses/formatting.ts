import { randomUUID } from "crypto";
import type {
  OpenAIOutputItem,
  OpenAIResponse,
  OutputTestItem,
} from "@/lib/responses/types";

export function formatOutputItem(item: OutputTestItem): OpenAIOutputItem {
  if (item.type === "message") {
    return {
      id: `msg_${randomUUID()}`,
      type: "message",
      role: "assistant",
      status: "completed",
      content: [
        {
          type: "output_text",
          text: item.content.content,
          annotations: [],
        },
      ],
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
  outputItems: OutputTestItem[]
): OpenAIResponse {
  return {
    id: `resp_${randomUUID()}`,
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    model,
    output: outputItems.map(formatOutputItem),
    status: "completed",
  };
}
