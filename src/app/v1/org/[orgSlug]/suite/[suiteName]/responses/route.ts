import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { openaiError } from "@/lib/errors";

interface MessageContent {
  role: string;
  content: string;
}

interface FunctionCallContent {
  call_id: string;
  name: string;
  arguments: string;
}

interface FunctionCallOutputContent {
  call_id: string;
  output: string;
}

type ItemContent = MessageContent | FunctionCallContent | FunctionCallOutputContent;

interface TestItemRecord {
  id: string;
  position: number;
  type: string;
  content: ItemContent;
}

function isOutputItem(item: TestItemRecord): boolean {
  if (item.type === "function_call") return true;
  if (item.type === "message") {
    const content = item.content as MessageContent;
    return content.role === "assistant";
  }
  return false;
}

interface NormalizedInputMessage {
  type: "message";
  role: string;
  content: string;
}

interface NormalizedInputFunctionCall {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
}

interface NormalizedInputFunctionCallOutput {
  type: "function_call_output";
  call_id: string;
  output: string;
}

type NormalizedInputItem =
  | NormalizedInputMessage
  | NormalizedInputFunctionCall
  | NormalizedInputFunctionCallOutput;

function normalizeInput(input: unknown): NormalizedInputItem[] {
  if (typeof input === "string") {
    return [{ type: "message", role: "user", content: input }];
  }

  const items = input as Array<Record<string, unknown>>;
  return items.map((item): NormalizedInputItem => {
    if (item.type === "function_call") {
      return {
        type: "function_call",
        call_id: item.call_id as string,
        name: item.name as string,
        arguments: item.arguments as string,
      };
    }

    if (item.type === "function_call_output") {
      return {
        type: "function_call_output",
        call_id: item.call_id as string,
        output: item.output as string,
      };
    }

    return {
      type: "message",
      role: item.role as string,
      content: item.content as string,
    };
  });
}

interface MatchSuccess {
  outputItems: TestItemRecord[];
}

interface MatchError {
  status: number;
  message: string;
  type: string;
  code: string;
}

type MatchResult = MatchSuccess | MatchError;

function isMatchError(result: MatchResult): result is MatchError {
  return "status" in result;
}

function matchInput(
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

  const outputItems: TestItemRecord[] = [];
  for (let i = matchBoundary; i < sequence.length; i++) {
    if (isOutputItem(sequence[i])) {
      outputItems.push(sequence[i]);
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
    const exp = expected.content as MessageContent;
    if (exp.role !== actual.role || exp.content !== actual.content) {
      return {
        status: 400,
        message:
          `Input mismatch at position ${position}: ` +
          `expected message with role '${exp.role}' and content ` +
          `'${exp.content}', got message with role '${actual.role}' ` +
          `and content '${actual.content}'`,
        type: "invalid_request_error",
        code: "input_mismatch",
      };
    }
    return null;
  }

  if (expected.type === "function_call" && actual.type === "function_call") {
    const exp = expected.content as FunctionCallContent;
    if (
      exp.call_id !== actual.call_id ||
      exp.name !== actual.name ||
      exp.arguments !== actual.arguments
    ) {
      return {
        status: 400,
        message:
          `Input mismatch at position ${position}: ` +
          `expected function_call '${exp.name}' with call_id '${exp.call_id}', ` +
          `got function_call '${actual.name}' with call_id '${actual.call_id}'`,
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
    const exp = expected.content as FunctionCallOutputContent;
    if (exp.call_id !== actual.call_id || exp.output !== actual.output) {
      return {
        status: 400,
        message:
          `Input mismatch at position ${position}: ` +
          `expected function_call_output with call_id '${exp.call_id}', ` +
          `got function_call_output with call_id '${actual.call_id}'`,
        type: "invalid_request_error",
        code: "input_mismatch",
      };
    }
    return null;
  }

  throw new Error(
    `Unhandled item type comparison: expected '${expected.type}', actual '${actual.type}'`
  );
}

interface OpenAIOutputMessage {
  id: string;
  type: "message";
  role: "assistant";
  status: "completed";
  content: Array<{
    type: "output_text";
    text: string;
    annotations: [];
  }>;
}

interface OpenAIOutputFunctionCall {
  id: string;
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
  status: "completed";
}

type OpenAIOutputItem = OpenAIOutputMessage | OpenAIOutputFunctionCall;

function formatOutputItem(item: TestItemRecord): OpenAIOutputItem {
  if (item.type === "message") {
    const content = item.content as MessageContent;
    return {
      id: `msg_${randomUUID()}`,
      type: "message",
      role: "assistant",
      status: "completed",
      content: [
        {
          type: "output_text",
          text: content.content,
          annotations: [],
        },
      ],
    };
  }

  if (item.type === "function_call") {
    const content = item.content as FunctionCallContent;
    return {
      id: `fc_${randomUUID()}`,
      type: "function_call",
      call_id: content.call_id,
      name: content.name,
      arguments: content.arguments,
      status: "completed",
    };
  }

  throw new Error(
    `Unexpected output item type: ${item.type} at position ${item.position}`
  );
}

interface OpenAIResponse {
  id: string;
  object: "response";
  created_at: number;
  model: string;
  output: OpenAIOutputItem[];
  status: "completed";
}

function formatResponse(
  model: string,
  outputItems: TestItemRecord[]
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string; suiteName: string }> }
) {
  const { orgSlug, suiteName } = await params;

  const body = await request.json();
  const model = body.model as string | undefined;
  const rawInput = body.input;

  if (!model) {
    return openaiError(
      400,
      "Missing required field: model",
      "invalid_request_error",
      "missing_model"
    );
  }
  if (rawInput === undefined || rawInput === null) {
    return openaiError(
      400,
      "Missing required field: input",
      "invalid_request_error",
      "missing_input"
    );
  }

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });
  if (!org) {
    return openaiError(
      404,
      `Organization '${orgSlug}' not found`,
      "not_found_error",
      "org_not_found"
    );
  }

  const suite = await prisma.testSuite.findUnique({
    where: { orgId_name: { orgId: org.id, name: suiteName } },
  });
  if (!suite) {
    return openaiError(
      404,
      `Test suite '${suiteName}' not found in organization '${orgSlug}'`,
      "not_found_error",
      "suite_not_found"
    );
  }

  const test = await prisma.test.findUnique({
    where: { testSuiteId_name: { testSuiteId: suite.id, name: model } },
  });
  if (!test) {
    return openaiError(
      404,
      `Model '${model}' not found in suite '${suiteName}'`,
      "not_found_error",
      "model_not_found"
    );
  }

  const sequence = await prisma.testItem.findMany({
    where: { testId: test.id },
    orderBy: { position: "asc" },
  });

  const normalizedInput = normalizeInput(rawInput);
  const result = matchInput(
    sequence as unknown as TestItemRecord[],
    normalizedInput
  );

  if (isMatchError(result)) {
    return openaiError(result.status, result.message, result.type, result.code);
  }

  const response = formatResponse(model, result.outputItems);
  return NextResponse.json(response);
}
