import { z } from "zod";
import { ContentBlockSchema } from "@/lib/messages/schemas";
import type {
  ContentBlock,
  MessageContent,
  NormalizedInput,
  NormalizedMessage,
  OutputMessage,
  TestItemRecord,
} from "@/lib/messages/types";

const MessageContentSchema = z.union([
  z.string(),
  z.array(ContentBlockSchema),
]);

export const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: MessageContentSchema,
});

export const MessagesSchema = z.array(MessageSchema);

export const SystemSchema = z.union([
  z.string(),
  z.array(ContentBlockSchema),
]);

const StoredSystemContentSchema = z.union([
  z
    .object({ text: z.string(), any_content: z.boolean().optional() })
    .passthrough(),
  z
    .object({ blocks: z.array(ContentBlockSchema), any_content: z.boolean().optional() })
    .passthrough(),
]);

const StoredMessageContentSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: MessageContentSchema,
  any_content: z.boolean().optional(),
});

const TestItemRecordSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    position: z.number().int(),
    type: z.literal("anthropic_system"),
    content: StoredSystemContentSchema,
  }),
  z.object({
    id: z.string(),
    position: z.number().int(),
    type: z.literal("anthropic_message"),
    content: StoredMessageContentSchema,
  }),
]);

const TestItemSequenceSchema = z.array(TestItemRecordSchema);

interface MatchSuccess {
  outputMessage: OutputMessage;
}

interface MatchError {
  status: number;
  message: string;
  type: string;
  code: string;
}

type MatchResult = MatchSuccess | MatchError;

export function isMatchError(result: MatchResult): result is MatchError {
  return "status" in result;
}

// Boundary helpers: normalize/validate external inputs.
export function parseTestSequence(sequence: unknown): TestItemRecord[] {
  const parsed = TestItemSequenceSchema.safeParse(sequence);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? issue.path.join(".") : "sequence";
    throw new Error(`Invalid test item sequence: ${path}: ${issue.message}`);
  }
  return parsed.data as TestItemRecord[];
}

export function normalizeRequest(
  system: z.infer<typeof SystemSchema> | undefined,
  messages: z.infer<typeof MessagesSchema>
): NormalizedInput {
  return {
    system: system
      ? { blocks: normalizeBlocks(system as string | ContentBlock[]) }
      : null,
    messages: messages.map((message) => ({
      role: message.role,
      content: normalizeBlocks(message.content as string | ContentBlock[]),
    })),
  };
}

function normalizeBlocks(content: string | ContentBlock[]): ContentBlock[] {
  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }
  return content;
}

function normalizeStoredMessage(content: MessageContent): NormalizedMessage {
  return {
    role: content.role,
    content: normalizeBlocks(content.content),
  };
}

function normalizeStoredSystem(
  content: TestItemRecord & { type: "anthropic_system" }
): ContentBlock[] {
  // Stored system content is a union without a discriminant, so probe by key.
  if ("text" in content.content) {
    return [{ type: "text", text: content.content.text }];
  }
  return content.content.blocks;
}

function mismatch(position: number, message: string): MatchError {
  return {
    status: 400,
    message: `Input mismatch at position ${position}: ${message}`,
    type: "invalid_request_error",
    code: "input_mismatch",
  };
}

function sequenceExhausted(): MatchError {
  return {
    status: 400,
    message: "Input extends beyond the defined test sequence",
    type: "invalid_request_error",
    code: "sequence_exhausted",
  };
}

function formatBlocks(blocks: ContentBlock[]): string {
  return JSON.stringify(blocks);
}

function assertNever(value: never, message: string): never {
  throw new Error(message);
}

function blocksEqual(expected: ContentBlock[], actual: ContentBlock[]): boolean {
  if (expected.length !== actual.length) return false;
  return expected.every((block, index) => compareBlock(block, actual[index]));
}

function compareBlock(expected: ContentBlock, actual: ContentBlock): boolean {
  if (expected.type !== actual.type) return false;

  switch (expected.type) {
    case "text":
      return expected.text === (actual as typeof expected).text;
    case "tool_use":
      {
        const actualToolUse = actual as typeof expected;
        return (
          expected.id === actualToolUse.id &&
          expected.name === actualToolUse.name &&
          jsonDeepEqual(expected.input, actualToolUse.input)
        );
      }
    case "tool_result":
      {
        const actualToolResult = actual as typeof expected;
        return (
          expected.tool_use_id === actualToolResult.tool_use_id &&
          jsonDeepEqual(expected.content, actualToolResult.content)
        );
      }
    default:
      return assertNever(expected, "Unexpected content block type");
  }
}

function jsonDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((val, i) => jsonDeepEqual(val, b[i]));
  }

  if (typeof a === "object" && typeof b === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(
      (key) => key in bObj && jsonDeepEqual(aObj[key], bObj[key])
    );
  }

  return false;
}

// Internal matching logic (assumes validated inputs).
export function matchInput(
  sequence: TestItemRecord[],
  input: NormalizedInput
): MatchResult {
  let messageIndex = 0;
  let systemMatched = false;

  for (const item of sequence) {
    if (item.type === "anthropic_system") {
      if (systemMatched) {
        return mismatch(item.position, "unexpected extra system prompt");
      }
      if (!input.system) {
        return mismatch(item.position, "expected system prompt, got none");
      }
      const anyContent = item.content.any_content === true;
      if (!anyContent) {
        const expectedBlocks = normalizeStoredSystem(item);
        const actualBlocks = input.system.blocks;
        if (!blocksEqual(expectedBlocks, actualBlocks)) {
          return mismatch(
            item.position,
            `expected system content ${formatBlocks(expectedBlocks)}, ` +
              `got ${formatBlocks(actualBlocks)}`
          );
        }
      }
      systemMatched = true;
      continue;
    }

    const expectedMessage = normalizeStoredMessage(item.content);
    const anyContent = item.content.any_content === true;

    if (expectedMessage.role === "user") {
      if (messageIndex >= input.messages.length) {
        return mismatch(item.position, "expected user message, got none");
      }

      const actual = input.messages[messageIndex];
      if (actual.role !== "user") {
        return mismatch(
          item.position,
          `expected role 'user', got '${actual.role}'`
        );
      }

      if (!anyContent && !blocksEqual(expectedMessage.content, actual.content)) {
        return mismatch(
          item.position,
          `expected content ${formatBlocks(expectedMessage.content)}, ` +
            `got ${formatBlocks(actual.content)}`
        );
      }

      messageIndex += 1;
      continue;
    }

    if (messageIndex >= input.messages.length) {
      return { outputMessage: expectedMessage as OutputMessage };
    }

    const actual = input.messages[messageIndex];
    if (actual.role !== "assistant") {
      return mismatch(
        item.position,
        `expected role 'assistant', got '${actual.role}'`
      );
    }

    if (!anyContent && !blocksEqual(expectedMessage.content, actual.content)) {
      return mismatch(
        item.position,
        `expected content ${formatBlocks(expectedMessage.content)}, ` +
          `got ${formatBlocks(actual.content)}`
      );
    }

    messageIndex += 1;
  }

  if (messageIndex < input.messages.length) {
    return sequenceExhausted();
  }

  if (input.system && !systemMatched) {
    return mismatch(0, "unexpected system prompt");
  }

  return sequenceExhausted();
}
