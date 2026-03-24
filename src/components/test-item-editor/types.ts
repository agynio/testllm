export type MessageContent = {
  role: "user" | "system" | "developer" | "assistant";
  content: string;
  any_role?: boolean;
  any_content?: boolean;
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

export type TestItemDraft =
  | { type: "message"; content: MessageContent; clientId: string }
  | { type: "function_call"; content: FunctionCallContent; clientId: string }
  | {
      type: "function_call_output";
      content: FunctionCallOutputContent;
      clientId: string;
    };

export type TestItemListItem =
  | { id?: string; type: "message"; content: MessageContent }
  | { id?: string; type: "function_call"; content: FunctionCallContent }
  | {
      id?: string;
      type: "function_call_output";
      content: FunctionCallOutputContent;
    };
