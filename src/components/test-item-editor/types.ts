import type { Prisma } from "@prisma/client";

export type MessageContent = {
  role: "user" | "system" | "developer" | "assistant";
  content: string;
  any_role?: boolean;
  any_content?: boolean;
  repeat?: boolean;
};

export type FunctionCallContent = {
  call_id: string;
  name: string;
  arguments: string;
};

export type FunctionCallOutputContent = {
  call_id: string;
  output: string;
};

export type AnthropicTextBlock = {
  type: "text";
  text: string;
};

export type AnthropicToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Prisma.InputJsonValue;
};

export type AnthropicToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: Prisma.InputJsonValue;
};

export type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;

export type AnthropicSystemContent =
  | { text: string; any_content?: boolean }
  | { blocks: AnthropicContentBlock[]; any_content?: boolean };

export type AnthropicMessageContent = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
  any_content?: boolean;
};

export type TestItemDraft =
  | { type: "message"; content: MessageContent; clientId: string }
  | { type: "function_call"; content: FunctionCallContent; clientId: string }
  | {
      type: "function_call_output";
      content: FunctionCallOutputContent;
      clientId: string;
    }
  | {
      type: "anthropic_system";
      content: AnthropicSystemContent;
      clientId: string;
    }
  | {
      type: "anthropic_message";
      content: AnthropicMessageContent;
      clientId: string;
    };

export type TestItemListItem =
  | { id?: string; type: "message"; content: MessageContent }
  | { id?: string; type: "function_call"; content: FunctionCallContent }
  | {
      id?: string;
      type: "function_call_output";
      content: FunctionCallOutputContent;
    }
  | { id?: string; type: "anthropic_system"; content: AnthropicSystemContent }
  | {
      id?: string;
      type: "anthropic_message";
      content: AnthropicMessageContent;
    };
