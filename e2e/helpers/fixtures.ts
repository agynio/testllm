export const simpleMessageSequence = [
  {
    type: "message",
    content: {
      role: "user",
      content: "Hello there",
    },
  },
  {
    type: "message",
    content: {
      role: "assistant",
      content: "Hi! How can I help?",
    },
  },
];

export const weatherSequence = [
  {
    type: "message",
    content: {
      role: "system",
      content: "You are a weather assistant.",
    },
  },
  {
    type: "message",
    content: {
      role: "user",
      content: "What is the weather in SF?",
    },
  },
  {
    type: "function_call",
    content: {
      call_id: "call_weather",
      name: "get_weather",
      arguments: "{\"city\":\"SF\"}",
    },
  },
  {
    type: "function_call_output",
    content: {
      call_id: "call_weather",
      output: "{\"temp\":65}",
    },
  },
  {
    type: "message",
    content: {
      role: "assistant",
      content: "It is 65F in SF.",
    },
  },
];

export const multiOutputSequence = [
  {
    type: "message",
    content: {
      role: "user",
      content: "Run the workflow",
    },
  },
  {
    type: "function_call",
    content: {
      call_id: "call_workflow",
      name: "step_one",
      arguments: "{}",
    },
  },
  {
    type: "message",
    content: {
      role: "assistant",
      content: "Working on it.",
    },
  },
  {
    type: "function_call_output",
    content: {
      call_id: "call_workflow",
      output: "{\"done\":true}",
    },
  },
];

export function withPositions<T extends { type: string; content: unknown }>(
  items: T[]
) {
  return items.map((item, index) => ({
    position: index,
    type: item.type,
    content: item.content,
  }));
}
