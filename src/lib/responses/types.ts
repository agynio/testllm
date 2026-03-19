export type TestItemType = "message" | "function_call" | "function_call_output";

export type InputMessageRole = "user" | "system" | "developer";
export type MessageRole = InputMessageRole | "assistant";

export interface MessageContent {
  role: MessageRole;
  content: string;
}

export interface FunctionCallContent {
  call_id: string;
  name: string;
  arguments: string;
}

export interface FunctionCallOutputContent {
  call_id: string;
  output: string;
}

export type ItemContent =
  | MessageContent
  | FunctionCallContent
  | FunctionCallOutputContent;

export interface BaseTestItemRecord {
  id: string;
  position: number;
}

export interface MessageItemRecord extends BaseTestItemRecord {
  type: "message";
  content: MessageContent;
}

export interface FunctionCallItemRecord extends BaseTestItemRecord {
  type: "function_call";
  content: FunctionCallContent;
}

export interface FunctionCallOutputItemRecord extends BaseTestItemRecord {
  type: "function_call_output";
  content: FunctionCallOutputContent;
}

export type TestItemRecord =
  | MessageItemRecord
  | FunctionCallItemRecord
  | FunctionCallOutputItemRecord;

export type OutputTestItem =
  | FunctionCallItemRecord
  | (MessageItemRecord & { content: MessageContent & { role: "assistant" } });

export interface NormalizedInputMessage {
  type: "message";
  role: InputMessageRole;
  content: string;
}

export interface NormalizedInputFunctionCall {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
}

export interface NormalizedInputFunctionCallOutput {
  type: "function_call_output";
  call_id: string;
  output: string;
}

export type NormalizedInputItem =
  | NormalizedInputMessage
  | NormalizedInputFunctionCall
  | NormalizedInputFunctionCallOutput;

export interface OpenAIOutputMessage {
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

export interface OpenAIOutputFunctionCall {
  id: string;
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
  status: "completed";
}

export type OpenAIOutputItem =
  | OpenAIOutputMessage
  | OpenAIOutputFunctionCall;

export interface OpenAIResponse {
  id: string;
  object: "response";
  created_at: number;
  model: string;
  output: OpenAIOutputItem[];
  status: "completed";
}
