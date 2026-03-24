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
  role: MessageRole;
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

export interface OutputTextContentPart {
  type: "output_text";
  text: string;
  annotations: [];
}

export interface OpenAIOutputMessage {
  id: string;
  type: "message";
  role: "assistant";
  status: "completed" | "in_progress";
  content: OutputTextContentPart[];
}

export interface OpenAIOutputFunctionCall {
  id: string;
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
  status: "completed" | "in_progress";
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

export interface OpenAIUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface OpenAIResponseInProgress {
  id: string;
  object: "response";
  created_at: number;
  model: string;
  output: [];
  status: "in_progress";
  usage: null;
}

export interface OpenAIResponseCompleted {
  id: string;
  object: "response";
  created_at: number;
  model: string;
  output: OpenAIOutputItem[];
  status: "completed";
  usage: OpenAIUsage;
}

export interface ResponseCreatedEvent {
  type: "response.created";
  response: OpenAIResponseInProgress;
  sequence_number: number;
}

export interface ResponseInProgressEvent {
  type: "response.in_progress";
  response: OpenAIResponseInProgress;
  sequence_number: number;
}

export interface ResponseOutputItemAddedEvent {
  type: "response.output_item.added";
  output_index: number;
  item: OpenAIOutputItem;
  sequence_number: number;
}

export interface ResponseContentPartAddedEvent {
  type: "response.content_part.added";
  item_id: string;
  output_index: number;
  content_index: number;
  part: OutputTextContentPart;
  sequence_number: number;
}

export interface ResponseOutputTextDeltaEvent {
  type: "response.output_text.delta";
  item_id: string;
  output_index: number;
  content_index: number;
  delta: string;
  sequence_number: number;
}

export interface ResponseOutputTextDoneEvent {
  type: "response.output_text.done";
  item_id: string;
  output_index: number;
  content_index: number;
  text: string;
  sequence_number: number;
}

export interface ResponseContentPartDoneEvent {
  type: "response.content_part.done";
  item_id: string;
  output_index: number;
  content_index: number;
  part: OutputTextContentPart;
  sequence_number: number;
}

export interface ResponseFunctionCallArgumentsDeltaEvent {
  type: "response.function_call_arguments.delta";
  item_id: string;
  output_index: number;
  delta: string;
  sequence_number: number;
}

export interface ResponseFunctionCallArgumentsDoneEvent {
  type: "response.function_call_arguments.done";
  item_id: string;
  output_index: number;
  name: string;
  arguments: string;
  sequence_number: number;
}

export interface ResponseOutputItemDoneEvent {
  type: "response.output_item.done";
  output_index: number;
  item: OpenAIOutputItem;
  sequence_number: number;
}

export interface ResponseCompletedEvent {
  type: "response.completed";
  response: OpenAIResponseCompleted;
  sequence_number: number;
}

export type SSEEvent =
  | ResponseCreatedEvent
  | ResponseInProgressEvent
  | ResponseOutputItemAddedEvent
  | ResponseContentPartAddedEvent
  | ResponseOutputTextDeltaEvent
  | ResponseOutputTextDoneEvent
  | ResponseContentPartDoneEvent
  | ResponseFunctionCallArgumentsDeltaEvent
  | ResponseFunctionCallArgumentsDoneEvent
  | ResponseOutputItemDoneEvent
  | ResponseCompletedEvent;
