import { z } from "zod";
import type {
  NormalizedInputFunctionCall,
  NormalizedInputItem,
  NormalizedInputMessage,
  OutputTestItem,
  TestItemRecord,
} from "@/lib/responses/types";

const InputMessageContentPartSchema = z.object({
  type: z.literal("input_text"),
  text: z.string(),
});

const InputMessageContentSchema = z.union([
  z.string(),
  z.array(InputMessageContentPartSchema),
]);

const InputMessageSchema = z.object({
  type: z.literal("message").optional(),
  role: z.enum(["user", "system", "developer", "assistant"]),
  content: InputMessageContentSchema,
});

const InputFunctionCallSchema = z.object({
  type: z.literal("function_call"),
  call_id: z.string(),
  name: z.string(),
  arguments: z.string(),
});

const InputFunctionCallOutputSchema = z.object({
  type: z.literal("function_call_output"),
  call_id: z.string(),
  output: z.string(),
});

const InputItemSchema = z.union([
  InputMessageSchema,
  InputFunctionCallSchema,
  InputFunctionCallOutputSchema,
]);

export const InputSchema = z.union([z.string(), z.array(InputItemSchema)]);

type InputSchemaValue = z.infer<typeof InputSchema>;
type InputMessageContent = z.infer<typeof InputMessageContentSchema>;

const StoredMessageContentSchema = z.object({
  role: z.enum(["user", "system", "developer", "assistant"]),
  content: z.string(),
  // Wildcards are only meaningful for input (non-assistant) messages.
  any_role: z.boolean().optional(),
  any_content: z.boolean().optional(),
  repeat: z.boolean().optional(),
});

const StoredFunctionCallContentSchema = z.object({
  call_id: z.string(),
  name: z.string(),
  arguments: z.string(),
});

const StoredFunctionCallOutputContentSchema = z.object({
  call_id: z.string(),
  output: z.string(),
});

const TestItemRecordSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    position: z.number().int(),
    type: z.literal("message"),
    content: StoredMessageContentSchema,
  }),
  z.object({
    id: z.string(),
    position: z.number().int(),
    type: z.literal("function_call"),
    content: StoredFunctionCallContentSchema,
  }),
  z.object({
    id: z.string(),
    position: z.number().int(),
    type: z.literal("function_call_output"),
    content: StoredFunctionCallOutputContentSchema,
  }),
]);

const TestItemSequenceSchema = z.array(TestItemRecordSchema);

interface MatchSuccess {
  outputItems: OutputTestItem[];
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
  return parsed.data;
}

// Boundary helper: convert validated request input into internal types.
export function normalizeInput(input: InputSchemaValue): NormalizedInputItem[] {
  if (typeof input === "string") {
    return [{ type: "message", role: "user", content: input }];
  }

  return input.map((item): NormalizedInputItem => {
    if (item.type === "function_call") {
      return {
        type: "function_call",
        call_id: item.call_id,
        name: item.name,
        arguments: item.arguments,
      };
    }

    if (item.type === "function_call_output") {
      return {
        type: "function_call_output",
        call_id: item.call_id,
        output: item.output,
      };
    }

    return {
      type: "message",
      role: item.role,
      content: normalizeMessageContent(item.content),
    };
  });
}

function normalizeMessageContent(content: InputMessageContent): string {
  if (typeof content === "string") return content;
  return content.map((part) => part.text).join("");
}

// Internal matching logic (assumes validated inputs).
export function isOutputItem(item: TestItemRecord): item is OutputTestItem {
  if (item.type === "function_call") return true;
  return item.type === "message" && item.content.role === "assistant";
}

type OutputDirectionInputItem =
  | NormalizedInputFunctionCall
  | (NormalizedInputMessage & { role: "assistant" });

function isOutputDirectionItem(
  item: NormalizedInputItem
): item is OutputDirectionInputItem {
  if (item.type === "function_call") return true;
  return item.type === "message" && item.role === "assistant";
}

function matchSegments(
  segments: Array<{ item: TestItemRecord; repeat: boolean }>,
  input: NormalizedInputItem[]
): MatchError | null {
  return matchRecursive(segments, 0, input, 0);
}

function matchRecursive(
  segments: Array<{ item: TestItemRecord; repeat: boolean }>,
  segIdx: number,
  input: NormalizedInputItem[],
  inputIdx: number
): MatchError | null {
  if (segIdx >= segments.length) {
    return inputIdx === input.length
      ? null
      : {
          status: 400,
          message: "Input extends beyond the defined test sequence",
          type: "invalid_request_error",
          code: "sequence_exhausted",
        };
  }

  const { item: expected, repeat } = segments[segIdx];

  if (!repeat) {
    if (inputIdx >= input.length) {
      return {
        status: 400,
        message: `Input too short: expected more items at segment ${segIdx}`,
        type: "invalid_request_error",
        code: "input_mismatch",
      };
    }
    const mismatch = compareItems(expected, input[inputIdx], inputIdx);
    if (mismatch) return mismatch;
    return matchRecursive(segments, segIdx + 1, input, inputIdx + 1);
  }

  const maxConsume = input.length - inputIdx;
  for (let count = maxConsume; count >= 1; count--) {
    let allMatch = true;
    for (let j = 0; j < count; j++) {
      if (compareItems(expected, input[inputIdx + j], inputIdx + j) !== null) {
        allMatch = false;
        break;
      }
    }
    if (!allMatch) continue;
    const rest = matchRecursive(segments, segIdx + 1, input, inputIdx + count);
    if (rest === null) return null;
  }

  return {
    status: 400,
    message: `Repeat wildcard at segment ${segIdx} could not match`,
    type: "invalid_request_error",
    code: "input_mismatch",
  };
}

export function matchInput(
  sequence: TestItemRecord[],
  input: NormalizedInputItem[]
): MatchResult {
  const segments: Array<{ item: TestItemRecord; repeat: boolean }> = [];
  let matchBoundary = -1;

  for (let i = 0; i < sequence.length; i++) {
    const item = sequence[i];
    if (isOutputItem(item)) {
      const err = matchSegments(segments, input);
      if (err === null) {
        matchBoundary = i;
        break;
      }
      if (err.code !== "sequence_exhausted") {
        return err;
      }
      const nextInput = input[segments.length];
      if (!nextInput || !isOutputDirectionItem(nextInput)) {
        return err;
      }
      segments.push({ item, repeat: false });
      continue;
    }
    const repeat =
      item.type === "message" &&
      item.content.any_role === true &&
      item.content.any_content === true &&
      item.content.repeat === true;
    segments.push({ item, repeat });
  }

  if (matchBoundary === -1) {
    const err = matchSegments(segments, input);
    if (err !== null) {
      return err;
    }
    return {
      status: 400,
      message: "Input extends beyond the defined test sequence",
      type: "invalid_request_error",
      code: "sequence_exhausted",
    };
  }

  const outputItems: OutputTestItem[] = [];
  for (let i = matchBoundary; i < sequence.length; i++) {
    const item = sequence[i];
    if (isOutputItem(item)) {
      outputItems.push(item);
    } else {
      break;
    }
  }

  return { outputItems };
}


/**
 * Compare two output strings for semantic equality.
 * If both strings are valid JSON, compare the parsed values (ignoring key order).
 * Otherwise, fall back to exact string comparison.
 */
function outputMatches(expected: string, actual: string): boolean {
  if (expected === actual) return true;
  try {
    const expectedParsed: unknown = JSON.parse(expected);
    const actualParsed: unknown = JSON.parse(actual);
    return jsonDeepEqual(expectedParsed, actualParsed);
  } catch {
    return false;
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

function compareItems(
  expected: TestItemRecord,
  actual: NormalizedInputItem,
  position: number
): MatchError | null {
  if (expected.type !== actual.type) {
    return {
      status: 400,
      message:
        `Input mismatch at position ${position}: ` +
        `expected type '${expected.type}', got type '${actual.type}'`,
      type: "invalid_request_error",
      code: "input_mismatch",
    };
  }

  if (expected.type === "message" && actual.type === "message") {
    const content = expected.content;
    const roleMatches = content.any_role || content.role === actual.role;
    const contentMatches =
      content.any_content || content.content === actual.content;
    if (!roleMatches || !contentMatches) {
      const roleLabel = content.any_role
        ? "any role"
        : `role '${content.role}'`;
      const contentLabel = content.any_content
        ? "any content"
        : `content '${content.content}'`;
      return {
        status: 400,
        message:
          `Input mismatch at position ${position}: ` +
          `expected message with ${roleLabel} and ${contentLabel}, ` +
          `got message with role '${actual.role}' and content ` +
          `'${actual.content}'`,
        type: "invalid_request_error",
        code: "input_mismatch",
      };
    }
    return null;
  }

  if (expected.type === "function_call" && actual.type === "function_call") {
    const content = expected.content;
    if (
      content.call_id !== actual.call_id ||
      content.name !== actual.name ||
      content.arguments !== actual.arguments
    ) {
      return {
        status: 400,
        message:
          `Input mismatch at position ${position}: ` +
          `expected function_call '${content.name}' with call_id ` +
          `'${content.call_id}', got function_call '${actual.name}' ` +
          `with call_id '${actual.call_id}'`,
        type: "invalid_request_error",
        code: "input_mismatch",
      };
    }
    return null;
  }

  if (
    expected.type === "function_call_output" &&
    actual.type === "function_call_output"
  ) {
    const content = expected.content;
    if (
      content.call_id !== actual.call_id ||
      !outputMatches(content.output, actual.output)
    ) {
      return {
        status: 400,
        message:
          `Input mismatch at position ${position}: ` +
          `expected function_call_output with call_id '${content.call_id}', ` +
          `got function_call_output with call_id '${actual.call_id}'`,
        type: "invalid_request_error",
        code: "input_mismatch",
      };
    }
    return null;
  }

  throw new Error(
    `Unhandled item type comparison: expected '${expected.type}', ` +
      `actual '${actual.type}'`
  );
}
