import { describe, expect, it } from "vitest";
import {
  isMatchError,
  matchInput,
  normalizeRequest,
} from "@/lib/messages/matching";
import type { ContentBlock, TestItemRecord } from "@/lib/messages/types";

const textBlock = (text: string): ContentBlock => ({ type: "text", text });

const toolUseBlock = (
  id: string,
  name: string,
  input: Record<string, unknown>
): ContentBlock => ({
  type: "tool_use",
  id,
  name,
  input,
});

const toolResultBlock = (
  tool_use_id: string,
  content: string | Record<string, unknown>
): ContentBlock => ({
  type: "tool_result",
  tool_use_id,
  content,
});

const systemItem = (
  position: number,
  content: { text: string } | { blocks: ContentBlock[] }
): TestItemRecord => ({
  id: `sys-${position}`,
  position,
  type: "anthropic_system",
  content,
});

const messageItem = (
  position: number,
  role: "user" | "assistant",
  content: string | ContentBlock[]
): TestItemRecord => ({
  id: `msg-${position}`,
  position,
  type: "anthropic_message",
  content: { role, content },
});

describe("matchInput", () => {
  it("matches a system + user input and returns the next assistant message", () => {
    const sequence = [
      systemItem(0, { text: "You are helpful." }),
      messageItem(1, "user", "Hello"),
      messageItem(2, "assistant", "Hi there"),
    ];

    const input = normalizeRequest("You are helpful.", [
      { role: "user", content: "Hello" },
    ]);

    const result = matchInput(sequence, input);
    expect(isMatchError(result)).toBe(false);
    if (!isMatchError(result)) {
      expect(result.outputMessage.role).toBe("assistant");
      expect(result.outputMessage.content).toEqual([textBlock("Hi there")]);
    }
  });

  it("matches multi-turn history with tool use", () => {
    const sequence = [
      systemItem(0, { text: "You are a weather assistant." }),
      messageItem(1, "user", [textBlock("Weather in SF?")]),
      messageItem(2, "assistant", [
        toolUseBlock("toolu_01", "get_weather", { city: "SF" }),
      ]),
      messageItem(3, "user", [
        toolResultBlock("toolu_01", "65F"),
      ]),
      messageItem(4, "assistant", [textBlock("It is 65F.")]),
    ];

    const firstInput = normalizeRequest("You are a weather assistant.", [
      { role: "user", content: "Weather in SF?" },
    ]);
    const firstResult = matchInput(sequence, firstInput);
    expect(isMatchError(firstResult)).toBe(false);
    if (!isMatchError(firstResult)) {
      expect(firstResult.outputMessage.content).toEqual([
        toolUseBlock("toolu_01", "get_weather", { city: "SF" }),
      ]);
    }

    const secondInput = normalizeRequest("You are a weather assistant.", [
      { role: "user", content: "Weather in SF?" },
      {
        role: "assistant",
        content: [toolUseBlock("toolu_01", "get_weather", { city: "SF" })],
      },
      {
        role: "user",
        content: [toolResultBlock("toolu_01", "65F")],
      },
    ]);
    const secondResult = matchInput(sequence, secondInput);
    expect(isMatchError(secondResult)).toBe(false);
    if (!isMatchError(secondResult)) {
      expect(secondResult.outputMessage.content).toEqual([
        textBlock("It is 65F."),
      ]);
    }
  });

  it("matches string message content against stored blocks", () => {
    const sequence = [
      messageItem(0, "user", [textBlock("Hello")]),
      messageItem(1, "assistant", [textBlock("Hi")]),
    ];

    const input = normalizeRequest(undefined, [
      { role: "user", content: "Hello" },
    ]);
    const result = matchInput(sequence, input);
    expect(isMatchError(result)).toBe(false);
    if (!isMatchError(result)) {
      expect(result.outputMessage.content).toEqual([textBlock("Hi")]);
    }
  });

  it("returns sequence_exhausted when input extends beyond the sequence", () => {
    const sequence = [
      messageItem(0, "user", "Hello"),
      messageItem(1, "assistant", "Hi"),
    ];

    const input = normalizeRequest(undefined, [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
      { role: "user", content: "Extra" },
    ]);

    const result = matchInput(sequence, input);
    expect(isMatchError(result)).toBe(true);
    if (isMatchError(result)) {
      expect(result.code).toBe("sequence_exhausted");
    }
  });

  it("matches tool_use inputs using JSON deep equality", () => {
    const sequence = [
      messageItem(0, "user", "Call tool"),
      messageItem(1, "assistant", [
        toolUseBlock("toolu_99", "lookup", { city: "SF", units: "f" }),
      ]),
      messageItem(2, "user", [toolResultBlock("toolu_99", "ok")]),
      messageItem(3, "assistant", [textBlock("Done")]),
    ];

    const input = normalizeRequest(undefined, [
      { role: "user", content: "Call tool" },
      {
        role: "assistant",
        content: [
          toolUseBlock("toolu_99", "lookup", { units: "f", city: "SF" }),
        ],
      },
      { role: "user", content: [toolResultBlock("toolu_99", "ok")] },
    ]);

    const result = matchInput(sequence, input);
    expect(isMatchError(result)).toBe(false);
    if (!isMatchError(result)) {
      expect(result.outputMessage.content).toEqual([textBlock("Done")]);
    }
  });
});
