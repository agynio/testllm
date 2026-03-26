import { describe, expect, it } from "vitest";
import {
  InputSchema,
  isMatchError,
  matchInput,
  normalizeInput,
} from "@/lib/responses/matching";
import type {
  MessageRole,
  TestItemRecord,
} from "@/lib/responses/types";

const messageItem = (
  position: number,
  role: MessageRole,
  content: string,
  options?: { any_role?: boolean; any_content?: boolean; repeat?: boolean }
): TestItemRecord => ({
  id: `msg-${position}`,
  position,
  type: "message",
  content: { role, content, ...options },
});

const functionCallItem = (
  position: number,
  call_id: string,
  name: string,
  args: string
): TestItemRecord => ({
  id: `fc-${position}`,
  position,
  type: "function_call",
  content: { call_id, name, arguments: args },
});

const functionCallOutputItem = (
  position: number,
  call_id: string,
  output: string
): TestItemRecord => ({
  id: `fco-${position}`,
  position,
  type: "function_call_output",
  content: { call_id, output },
});

describe("matchInput", () => {
  it("matches a single message and returns the next output", () => {
    const sequence = [
      messageItem(0, "user", "Hello"),
      messageItem(1, "assistant", "Hi there"),
    ];
    const input = normalizeInput([{ role: "user", content: "Hello" }]);
    const result = matchInput(sequence, input);

    expect(isMatchError(result)).toBe(false);
    if (!isMatchError(result)) {
      expect(result.outputItems).toHaveLength(1);
      expect(result.outputItems[0].type).toBe("message");
    }
  });

  it("supports multi-turn matching", () => {
    const sequence = [
      messageItem(0, "system", "System prompt"),
      messageItem(1, "user", "What is the weather?"),
      functionCallItem(2, "call-1", "get_weather", "{\"city\":\"SF\"}"),
      functionCallOutputItem(3, "call-1", "{\"temp\":65}"),
      messageItem(4, "assistant", "It is 65°F."),
    ];

    const firstInput = normalizeInput([
      { role: "system", content: "System prompt" },
      { role: "user", content: "What is the weather?" },
    ]);
    const firstResult = matchInput(sequence, firstInput);
    expect(isMatchError(firstResult)).toBe(false);
    if (!isMatchError(firstResult)) {
      expect(firstResult.outputItems).toHaveLength(1);
      expect(firstResult.outputItems[0].type).toBe("function_call");
    }

    const secondInput = normalizeInput([
      { role: "system", content: "System prompt" },
      { role: "user", content: "What is the weather?" },
      {
        type: "function_call",
        call_id: "call-1",
        name: "get_weather",
        arguments: "{\"city\":\"SF\"}",
      },
      { type: "function_call_output", call_id: "call-1", output: "{\"temp\":65}" },
    ]);
    const secondResult = matchInput(sequence, secondInput);
    expect(isMatchError(secondResult)).toBe(false);
    if (!isMatchError(secondResult)) {
      expect(secondResult.outputItems).toHaveLength(1);
      expect(secondResult.outputItems[0].type).toBe("message");
    }
  });

  it("matches multi-turn input with assistant messages", () => {
    const sequence = [
      messageItem(0, "system", "System prompt"),
      messageItem(1, "user", "Hello"),
      messageItem(2, "assistant", "Hi there"),
      messageItem(3, "user", "How are you?"),
      messageItem(4, "assistant", "Doing great"),
    ];

    const parsedInput = InputSchema.parse([
      { role: "system", content: "System prompt" },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
      { role: "user", content: "How are you?" },
    ]);

    const result = matchInput(sequence, normalizeInput(parsedInput));

    expect(isMatchError(result)).toBe(false);
    if (!isMatchError(result)) {
      expect(result.outputItems).toHaveLength(1);
      expect(result.outputItems[0].type).toBe("message");
      if (result.outputItems[0].type === "message") {
        expect(result.outputItems[0].content).toEqual({
          role: "assistant",
          content: "Doing great",
        });
      }
    }
  });

  it("returns multiple output items in one response", () => {
    const sequence = [
      messageItem(0, "user", "Run the workflow"),
      functionCallItem(1, "call-1", "step_one", "{}"),
      messageItem(2, "assistant", "Working on it"),
      functionCallOutputItem(3, "call-1", "{\"done\":true}"),
    ];
    const input = normalizeInput([{ role: "user", content: "Run the workflow" }]);
    const result = matchInput(sequence, input);

    expect(isMatchError(result)).toBe(false);
    if (!isMatchError(result)) {
      expect(result.outputItems).toHaveLength(2);
      expect(result.outputItems.map((item) => item.type)).toEqual([
        "function_call",
        "message",
      ]);
    }
  });

  it("normalizes string input into a user message", () => {
    const normalized = normalizeInput("Hello");
    expect(normalized).toEqual([
      { type: "message", role: "user", content: "Hello" },
    ]);
  });

  it("keeps string content unchanged in array input", () => {
    const normalized = normalizeInput([
      { role: "user", content: "Hello there" },
    ]);

    expect(normalized).toEqual([
      { type: "message", role: "user", content: "Hello there" },
    ]);
  });

  it("normalizes array content into a single string", () => {
    const normalized = normalizeInput([
      {
        role: "user",
        content: [{ type: "input_text", text: "Hello" }],
      },
    ]);

    expect(normalized).toEqual([
      { type: "message", role: "user", content: "Hello" },
    ]);
  });

  it("concatenates multi-part array content", () => {
    const normalized = normalizeInput([
      {
        role: "user",
        content: [
          { type: "input_text", text: "Hello " },
          { type: "input_text", text: "there" },
        ],
      },
    ]);

    expect(normalized).toEqual([
      { type: "message", role: "user", content: "Hello there" },
    ]);
  });

  it("matches any_content without requiring exact content", () => {
    const sequence = [
      messageItem(0, "user", "Expected", { any_content: true }),
      messageItem(1, "assistant", "Output"),
    ];
    const input = normalizeInput([{ role: "user", content: "Actual" }]);
    const result = matchInput(sequence, input);

    expect(isMatchError(result)).toBe(false);
    if (!isMatchError(result)) {
      expect(result.outputItems).toHaveLength(1);
      expect(result.outputItems[0].type).toBe("message");
    }
  });

  it("matches any_role without requiring exact role", () => {
    const sequence = [
      messageItem(0, "user", "Hello", { any_role: true }),
      messageItem(1, "assistant", "Output"),
    ];
    const input = normalizeInput([{ role: "system", content: "Hello" }]);
    const result = matchInput(sequence, input);

    expect(isMatchError(result)).toBe(false);
    if (!isMatchError(result)) {
      expect(result.outputItems).toHaveLength(1);
      expect(result.outputItems[0].type).toBe("message");
    }
  });

  it("matches when any_role and any_content are both true", () => {
    const sequence = [
      messageItem(0, "user", "Expected", {
        any_role: true,
        any_content: true,
      }),
      messageItem(1, "assistant", "Output"),
    ];
    const input = normalizeInput([
      { role: "system", content: "Different content" },
    ]);
    const result = matchInput(sequence, input);

    expect(isMatchError(result)).toBe(false);
    if (!isMatchError(result)) {
      expect(result.outputItems).toHaveLength(1);
      expect(result.outputItems[0].type).toBe("message");
    }
  });

  it("matches repeat wildcard absorbing multiple input items", () => {
    const sequence = [
      messageItem(0, "user", "Wildcard", {
        any_role: true,
        any_content: true,
        repeat: true,
      }),
      messageItem(1, "user", "hi"),
      messageItem(2, "assistant", "Output"),
    ];
    const input = normalizeInput([
      { role: "system", content: "Environment context" },
      { role: "user", content: "hi" },
    ]);
    const result = matchInput(sequence, input);

    expect(isMatchError(result)).toBe(false);
    if (!isMatchError(result)) {
      expect(result.outputItems).toHaveLength(1);
      expect(result.outputItems[0].type).toBe("message");
    }
  });

  it("matches repeat wildcard absorbing many input items", () => {
    const sequence = [
      messageItem(0, "user", "Wildcard", {
        any_role: true,
        any_content: true,
        repeat: true,
      }),
      messageItem(1, "user", "hi"),
      messageItem(2, "assistant", "Output"),
    ];
    const input = normalizeInput([
      { role: "developer", content: "Developer instructions" },
      { role: "system", content: "Environment context" },
      { role: "user", content: "agents.md" },
      { role: "user", content: "hi" },
    ]);
    const result = matchInput(sequence, input);

    expect(isMatchError(result)).toBe(false);
    if (!isMatchError(result)) {
      expect(result.outputItems).toHaveLength(1);
      expect(result.outputItems[0].type).toBe("message");
    }
  });

  it("repeat wildcard requires at least one match", () => {
    const sequence = [
      messageItem(0, "user", "Wildcard", {
        any_role: true,
        any_content: true,
        repeat: true,
      }),
      messageItem(1, "user", "hi"),
      messageItem(2, "assistant", "Output"),
    ];
    const input = normalizeInput([{ role: "user", content: "hi" }]);
    const result = matchInput(sequence, input);

    expect(isMatchError(result)).toBe(true);
    if (isMatchError(result)) {
      expect(result.code).toBe("input_mismatch");
    }
  });

  it("non-repeat wildcards still match exactly one item", () => {
    const sequence = [
      messageItem(0, "user", "Wildcard", {
        any_role: true,
        any_content: true,
      }),
      messageItem(1, "user", "hi"),
      messageItem(2, "assistant", "Output"),
    ];
    const input = normalizeInput([
      { role: "system", content: "Environment context" },
      { role: "user", content: "hi" },
    ]);
    const result = matchInput(sequence, input);

    expect(isMatchError(result)).toBe(false);
    if (!isMatchError(result)) {
      expect(result.outputItems).toHaveLength(1);
      expect(result.outputItems[0].type).toBe("message");
    }
  });

  it("requires exact match when no wildcards are set", () => {
    const sequence = [
      messageItem(0, "user", "Expected"),
      messageItem(1, "assistant", "Output"),
    ];
    const input = normalizeInput([{ role: "user", content: "Actual" }]);
    const result = matchInput(sequence, input);

    expect(isMatchError(result)).toBe(true);
    if (isMatchError(result)) {
      expect(result.code).toBe("input_mismatch");
    }
  });

  it("returns sequence_exhausted when input extends past sequence", () => {
    const sequence = [messageItem(0, "user", "Hello")];
    const input = normalizeInput([
      { role: "user", content: "Hello" },
      { role: "user", content: "Extra" },
    ]);
    const result = matchInput(sequence, input);

    expect(isMatchError(result)).toBe(true);
    if (isMatchError(result)) {
      expect(result.code).toBe("sequence_exhausted");
    }
  });

  it("returns input_mismatch when input is shorter than expected", () => {
    const sequence = [
      messageItem(0, "user", "Hello"),
      messageItem(1, "user", "Again"),
    ];
    const input = normalizeInput([{ role: "user", content: "Hello" }]);
    const result = matchInput(sequence, input);

    expect(isMatchError(result)).toBe(true);
    if (isMatchError(result)) {
      expect(result.code).toBe("input_mismatch");
    }
  });

  it("handles an empty sequence", () => {
    const sequence: TestItemRecord[] = [];
    const input = normalizeInput([]);
    const result = matchInput(sequence, input);

    expect(isMatchError(result)).toBe(true);
    if (isMatchError(result)) {
      expect(result.code).toBe("sequence_exhausted");
    }
  });
});
