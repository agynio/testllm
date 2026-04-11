"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  AnthropicContentBlock,
  AnthropicMessageContent,
  AnthropicSystemContent,
  AnthropicTextBlock,
  MessageContent,
  TestItemDraft,
} from "@/components/test-item-editor/types";

type ItemContentFieldsProps = {
  item: TestItemDraft;
  onChange: (item: TestItemDraft) => void;
};

function textToBlocks(text: string) {
  if (!text) return [] as AnthropicContentBlock[];
  return [{ type: "text", text }] as AnthropicContentBlock[];
}

function isTextBlock(block: AnthropicContentBlock): block is AnthropicTextBlock {
  return block.type === "text";
}

function hasSystemBlocks(
  content: AnthropicSystemContent
): content is { blocks: AnthropicContentBlock[] } {
  return "blocks" in content;
}

function isMessageBlocks(
  content: AnthropicMessageContent["content"]
): content is AnthropicContentBlock[] {
  return Array.isArray(content);
}

function blocksToText(blocks: AnthropicContentBlock[]) {
  if (!blocks.every(isTextBlock)) return null;
  return blocks.map((block) => block.text).join("\n");
}

function parseBlocksInput(value: string) {
  if (!value.trim()) return [] as AnthropicContentBlock[];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as AnthropicContentBlock[]) : null;
  } catch {
    return null;
  }
}

function stringifyBlocks(blocks: AnthropicContentBlock[]) {
  return JSON.stringify(blocks, null, 2);
}

export function ItemContentFields({ item, onChange }: ItemContentFieldsProps) {
  const [systemBlocksValue, setSystemBlocksValue] = React.useState(() => {
    if (item.type !== "anthropic_system") return "";
    if ("blocks" in item.content) return stringifyBlocks(item.content.blocks);
    return stringifyBlocks(textToBlocks(item.content.text));
  });

  const [messageBlocksValue, setMessageBlocksValue] = React.useState(() => {
    if (item.type !== "anthropic_message") return "";
    if (Array.isArray(item.content.content)) {
      return stringifyBlocks(item.content.content);
    }
    return stringifyBlocks(textToBlocks(item.content.content));
  });

  React.useEffect(() => {
    if (item.type !== "anthropic_system") return;
    if ("blocks" in item.content) {
      setSystemBlocksValue(stringifyBlocks(item.content.blocks));
    }
  }, [item]);

  React.useEffect(() => {
    if (item.type !== "anthropic_message") return;
    if (Array.isArray(item.content.content)) {
      setMessageBlocksValue(stringifyBlocks(item.content.content));
    }
  }, [item]);

  if (item.type === "message") {
    const wildcardDisabled = item.content.role === "assistant";
    const anyRole = !wildcardDisabled && Boolean(item.content.any_role);
    const anyContent = !wildcardDisabled && Boolean(item.content.any_content);
    const anyRoleId = `${item.clientId}-any-role`;
    const anyContentId = `${item.clientId}-any-content`;

    return (
      <div className="grid gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Role</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id={anyRoleId}
                  checked={anyRole}
                  disabled={wildcardDisabled}
                  onCheckedChange={(checked) =>
                    onChange({
                      ...item,
                      content: {
                        ...item.content,
                        any_role: checked === true ? true : undefined,
                      },
                    })
                  }
                />
                <Label htmlFor={anyRoleId} className="text-xs text-muted-foreground">
                  Any
                </Label>
              </div>
            </div>
            <Select
              value={item.content.role}
              disabled={anyRole}
              onValueChange={(value) =>
                onChange({
                  ...item,
                  content: {
                    ...item.content,
                    role: value as MessageContent["role"],
                    any_role:
                      value === "assistant"
                        ? undefined
                        : item.content.any_role,
                    any_content:
                      value === "assistant"
                        ? undefined
                        : item.content.any_content,
                  },
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">user</SelectItem>
                <SelectItem value="system">system</SelectItem>
                <SelectItem value="developer">developer</SelectItem>
                <SelectItem value="assistant">assistant</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Content</Label>
            <div className="flex items-center gap-2">
              <Checkbox
                id={anyContentId}
                checked={anyContent}
                disabled={wildcardDisabled}
                onCheckedChange={(checked) =>
                  onChange({
                    ...item,
                    content: {
                      ...item.content,
                      any_content: checked === true ? true : undefined,
                    },
                  })
                }
              />
              <Label htmlFor={anyContentId} className="text-xs text-muted-foreground">
                Any
              </Label>
            </div>
          </div>
          <Textarea
            value={item.content.content}
            disabled={anyContent}
            onChange={(event) =>
              onChange({
                ...item,
                content: { ...item.content, content: event.target.value },
              })
            }
            placeholder="Message content"
            className="min-h-[90px]"
          />
        </div>
      </div>
    );
  }

  if (item.type === "anthropic_system") {
    let blocks: AnthropicContentBlock[] = [];
    let usesBlocks = false;
    let textValue = "";

    if (hasSystemBlocks(item.content)) {
      usesBlocks = true;
      blocks = item.content.blocks;
    } else {
      textValue = item.content.text;
      blocks = textToBlocks(item.content.text);
    }
    const canSwitchToText = blocksToText(blocks) !== null;
    const toggleId = `${item.clientId}-system-json`;

    return (
      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <Label>System Prompt</Label>
          <div className="flex items-center gap-2">
            <Checkbox
              id={toggleId}
              checked={usesBlocks}
              disabled={usesBlocks && !canSwitchToText}
              onCheckedChange={(checked) => {
                if (checked) {
                  setSystemBlocksValue(stringifyBlocks(blocks));
                  onChange({
                    ...item,
                    content: { blocks },
                  });
                  return;
                }
                const textValue = blocksToText(blocks);
                if (textValue === null) return;
                onChange({
                  ...item,
                  content: { text: textValue },
                });
              }}
            />
            <Label htmlFor={toggleId} className="text-xs text-muted-foreground">
              JSON
            </Label>
          </div>
        </div>
        {usesBlocks ? (
          <Textarea
            value={systemBlocksValue}
            onChange={(event) => {
              const nextValue = event.target.value;
              setSystemBlocksValue(nextValue);
              const parsed = parseBlocksInput(nextValue);
              if (!parsed) return;
              onChange({
                ...item,
                content: { blocks: parsed },
              });
            }}
            placeholder='[{"type":"text","text":"System prompt"}]'
            className="min-h-[110px] font-mono"
          />
        ) : (
          <Textarea
            value={textValue}
            onChange={(event) =>
              onChange({
                ...item,
                content: { text: event.target.value },
              })
            }
            placeholder="System prompt"
            className="min-h-[90px]"
          />
        )}
      </div>
    );
  }

  if (item.type === "anthropic_message") {
    let blocks: AnthropicContentBlock[] = [];
    let usesBlocks = false;

    if (isMessageBlocks(item.content.content)) {
      usesBlocks = true;
      blocks = item.content.content;
    } else {
      blocks = textToBlocks(item.content.content);
    }
    const canSwitchToText = blocksToText(blocks) !== null;
    const toggleId = `${item.clientId}-message-json`;

    return (
      <div className="grid gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Role</Label>
            <Select
              value={item.content.role}
              onValueChange={(value) =>
                onChange({
                  ...item,
                  content: {
                    ...item.content,
                    role: value as AnthropicMessageContent["role"],
                  },
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">user</SelectItem>
                <SelectItem value="assistant">assistant</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Content</Label>
            <div className="flex items-center gap-2">
              <Checkbox
                id={toggleId}
                checked={usesBlocks}
                disabled={usesBlocks && !canSwitchToText}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setMessageBlocksValue(stringifyBlocks(blocks));
                    onChange({
                      ...item,
                      content: {
                        ...item.content,
                        content: blocks,
                      },
                    });
                    return;
                  }
                  const textValue = blocksToText(blocks);
                  if (textValue === null) return;
                  onChange({
                    ...item,
                    content: {
                      ...item.content,
                      content: textValue,
                    },
                  });
                }}
              />
              <Label htmlFor={toggleId} className="text-xs text-muted-foreground">
                JSON
              </Label>
            </div>
          </div>
          {usesBlocks ? (
            <Textarea
              value={messageBlocksValue}
              onChange={(event) => {
                const nextValue = event.target.value;
                setMessageBlocksValue(nextValue);
                const parsed = parseBlocksInput(nextValue);
                if (!parsed) return;
                onChange({
                  ...item,
                  content: {
                    ...item.content,
                    content: parsed,
                  },
                });
              }}
              placeholder='[{"type":"text","text":"Message"}]'
              className="min-h-[120px] font-mono"
            />
          ) : (
            <Textarea
              value={
                typeof item.content.content === "string"
                  ? item.content.content
                  : ""
              }
              onChange={(event) =>
                onChange({
                  ...item,
                  content: {
                    ...item.content,
                    content: event.target.value,
                  },
                })
              }
              placeholder="Message content"
              className="min-h-[90px]"
            />
          )}
        </div>
      </div>
    );
  }

  if (item.type === "function_call") {
    return (
      <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Call ID</Label>
            <Input
              value={item.content.call_id}
              onChange={(event) =>
                onChange({
                  ...item,
                  content: { ...item.content, call_id: event.target.value },
                })
              }
              placeholder="call_123"
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label>Function Name</Label>
            <Input
              value={item.content.name}
              onChange={(event) =>
                onChange({
                  ...item,
                  content: { ...item.content, name: event.target.value },
                })
              }
              placeholder="get_weather"
              className="font-mono"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Arguments</Label>
          <Textarea
            value={item.content.arguments}
            onChange={(event) =>
              onChange({
                ...item,
                content: { ...item.content, arguments: event.target.value },
              })
            }
            placeholder='{"key": "value"}'
            className="min-h-[100px] font-mono"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Call ID</Label>
          <Input
            value={item.content.call_id}
            onChange={(event) =>
              onChange({
                ...item,
                content: { ...item.content, call_id: event.target.value },
              })
            }
            placeholder="call_123"
            className="font-mono"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Output</Label>
        <Textarea
          value={item.content.output}
          onChange={(event) =>
            onChange({
              ...item,
              content: { ...item.content, output: event.target.value },
            })
          }
          placeholder='{"result": "value"}'
          className="min-h-[100px] font-mono"
        />
      </div>
    </div>
  );
}
