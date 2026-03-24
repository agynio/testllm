import type { Prisma, TestItemType } from "@prisma/client";

export type TestItemFixture = {
  type: TestItemType;
  content: Prisma.InputJsonValue;
};

export const simpleMessageSequence: TestItemFixture[] = [
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

export const weatherSequence: TestItemFixture[] = [
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

export const systemPromptSequence: TestItemFixture[] = [
  {
    type: "message",
    content: {
      role: "system",
      content: "You are personal assistant",
    },
  },
  {
    type: "message",
    content: {
      role: "user",
      content: "hi",
    },
  },
  {
    type: "message",
    content: {
      role: "assistant",
      content: "Hello! I am here to help!",
    },
  },
];

export const anyRoleSequence: TestItemFixture[] = [
  {
    type: "message",
    content: {
      role: "user",
      content: "Hello",
      any_role: true,
    },
  },
  {
    type: "message",
    content: {
      role: "assistant",
      content: "Role wildcard matched.",
    },
  },
];

export const anyContentSequence: TestItemFixture[] = [
  {
    type: "message",
    content: {
      role: "user",
      content: "Ignored",
      any_content: true,
    },
  },
  {
    type: "message",
    content: {
      role: "assistant",
      content: "Content wildcard matched.",
    },
  },
];

export const multiOutputSequence: TestItemFixture[] = [
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

export function withPositions<T extends TestItemFixture>(
  items: ReadonlyArray<T>
) {
  return items.map((item, index) => ({
    position: index,
    type: item.type,
    content: item.content,
  }));
}
