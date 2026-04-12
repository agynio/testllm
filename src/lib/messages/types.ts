import type { Prisma } from "@prisma/client";

export type MessageRole = "user" | "assistant";

export interface TextBlock extends Prisma.InputJsonObject {
  type: "text";
  text: string;
}

export interface ToolUseBlock extends Prisma.InputJsonObject {
  type: "tool_use";
  id: string;
  name: string;
  input: Prisma.InputJsonValue;
}

export interface ToolResultBlock extends Prisma.InputJsonObject {
  type: "tool_result";
  tool_use_id: string;
  content: Prisma.InputJsonValue;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export type SystemContent =
  | { text: string; any_content?: boolean }
  | { blocks: ContentBlock[]; any_content?: boolean };

export interface MessageContent {
  role: MessageRole;
  content: string | ContentBlock[];
  any_content?: boolean;
}

export interface BaseTestItemRecord {
  id: string;
  position: number;
}

export interface SystemItemRecord extends BaseTestItemRecord {
  type: "anthropic_system";
  content: SystemContent;
}

export interface MessageItemRecord extends BaseTestItemRecord {
  type: "anthropic_message";
  content: MessageContent;
}

export type TestItemRecord = SystemItemRecord | MessageItemRecord;

export interface NormalizedSystem {
  blocks: ContentBlock[];
}

export interface NormalizedMessage {
  role: MessageRole;
  content: ContentBlock[];
}

export interface NormalizedInput {
  system: NormalizedSystem | null;
  messages: NormalizedMessage[];
}

export type OutputMessage = NormalizedMessage & { role: "assistant" };

export type StopReason = "end_turn" | "tool_use";

export interface AnthropicMessageResponse extends Prisma.InputJsonObject {
  id: string;
  type: "message";
  role: "assistant";
  model: string;
  content: ContentBlock[];
  stop_reason: StopReason;
  stop_sequence: null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface AnthropicMessageStart extends Prisma.InputJsonObject {
  id: string;
  type: "message";
  role: "assistant";
  model: string;
  content: [];
  stop_reason: null;
  stop_sequence: null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface TextDelta extends Prisma.InputJsonObject {
  type: "text_delta";
  text: string;
}

export interface InputJsonDelta extends Prisma.InputJsonObject {
  type: "input_json_delta";
  partial_json: string;
}

export interface MessageStartEvent {
  type: "message_start";
  message: AnthropicMessageStart;
}

export interface ContentBlockStartEvent {
  type: "content_block_start";
  index: number;
  content_block: ContentBlock;
}

export interface ContentBlockDeltaEvent {
  type: "content_block_delta";
  index: number;
  delta: TextDelta | InputJsonDelta;
}

export interface ContentBlockStopEvent {
  type: "content_block_stop";
  index: number;
}

export interface MessageDeltaEvent {
  type: "message_delta";
  delta: {
    stop_reason: StopReason;
    stop_sequence: null;
  };
  usage: {
    output_tokens: number;
  };
}

export interface MessageStopEvent {
  type: "message_stop";
}

export type SSEEvent =
  | MessageStartEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | MessageDeltaEvent
  | MessageStopEvent;
