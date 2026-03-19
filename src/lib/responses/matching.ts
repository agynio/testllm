import { z } from "zod";
import type {
  NormalizedInputItem,
  OutputTestItem,
  TestItemRecord,
} from "@/lib/responses/types";

const InputMessageSchema = z.object({
  type: z.literal("message").optional(),
  role: z.enum(["user", "system", "developer"]),
  content: z.string(),
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

const StoredMessageContentSchema = z.object({
  role: z.enum(["user", "system", "developer", "assistant"]),
  content: z.string(),
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
      content: item.content,
    };
  });
}

// Internal matching logic (assumes validated inputs).
export function isOutputItem(item: TestItemRecord): item is OutputTestItem {
  if (item.type === "function_call") return true;
  return item.type === "message" && item.content.role === "assistant";
}

export function matchInput(
  sequence: TestItemRecord[],
  input: NormalizedInputItem[]
): MatchResult {
  const expectedItems: TestItemRecord[] = [];
  let matchBoundary = -1;

  for (let i = 0; i < sequence.length; i++) {
    const item = sequence[i];

    if (isOutputItem(item)) {
      if (expectedItems.length === input.length) {
        matchBoundary = i;
        break;
      }
      expectedItems.push(item);
    } else {
      expectedItems.push(item);
    }
  }

  if (matchBoundary === -1) {
    if (expectedItems.length <= input.length) {
      return {
        status: 400,
        message: "Input extends beyond the defined test sequence",
        type: "invalid_request_error",
        code: "sequence_exhausted",
      };
    }
    return {
      status: 400,
      message:
        `Input mismatch: expected ${expectedItems.length} input items ` +
        `but got ${input.length}`,
      type: "invalid_request_error",
      code: "input_mismatch",
    };
  }

  for (let i = 0; i < expectedItems.length; i++) {
    const expected = expectedItems[i];
    const actual = input[i];
    const mismatch = compareItems(expected, actual, i);
    if (mismatch) return mismatch;
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
    if (content.role !== actual.role || content.content !== actual.content) {
      return {
        status: 400,
        message:
          `Input mismatch at position ${position}: ` +
          `expected message with role '${content.role}' and content ` +
          `'${content.content}', got message with role '${actual.role}' ` +
          `and content '${actual.content}'`,
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
    if (content.call_id !== actual.call_id || content.output !== actual.output) {
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
