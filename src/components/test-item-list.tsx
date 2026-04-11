"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import type {
  AnthropicContentBlock,
  TestItemListItem,
} from "@/components/test-item-editor/types";
import { getTestItemDirection } from "@/components/test-item-editor/utils";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type { TestItemListItem } from "@/components/test-item-editor/types";

type TestItemListProps = {
  items: TestItemListItem[];
};

function formatJson(value: string) {
  try {
    const parsed = JSON.parse(value);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
}

function formatJsonValue(value: unknown) {
  if (typeof value === "string") {
    return formatJson(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function summarizeBlocks(blocks: AnthropicContentBlock[]) {
  return blocks
    .map((block) => {
      if (block.type === "text") return block.text;
      if (block.type === "tool_use") return `tool_use:${block.name}`;
      return `tool_result:${block.tool_use_id}`;
    })
    .join(" ");
}

function renderBlocks(blocks: AnthropicContentBlock[]) {
  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        if (block.type === "text") {
          return (
            <div key={`${block.type}-${index}`} className="whitespace-pre-wrap">
              {block.text}
            </div>
          );
        }
        if (block.type === "tool_use") {
          return (
            <div key={`${block.type}-${index}`} className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Tool use: {block.name} ({block.id})
              </p>
              <pre className="whitespace-pre-wrap rounded-md bg-background p-3 text-xs">
                {formatJsonValue(block.input)}
              </pre>
            </div>
          );
        }
        return (
          <div key={`${block.type}-${index}`} className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Tool result: {block.tool_use_id}
            </p>
            <pre className="whitespace-pre-wrap rounded-md bg-background p-3 text-xs">
              {formatJsonValue(block.content)}
            </pre>
          </div>
        );
      })}
    </div>
  );
}

function getPreview(item: TestItemListItem) {
  if (item.type === "message") {
    return item.content.any_content ? "<any content>" : item.content.content;
  }
  if (item.type === "anthropic_system") {
    return "text" in item.content
      ? item.content.text
      : summarizeBlocks(item.content.blocks);
  }
  if (item.type === "anthropic_message") {
    return typeof item.content.content === "string"
      ? item.content.content
      : summarizeBlocks(item.content.content);
  }
  if (item.type === "function_call") {
    return `${item.content.name}(${item.content.arguments})`;
  }
  return item.content.output;
}

function getMetaLabel(item: TestItemListItem) {
  if (item.type === "message") {
    return item.content.any_role ? "any role" : item.content.role;
  }
  if (item.type === "anthropic_system") {
    return "system";
  }
  if (item.type === "anthropic_message") {
    return item.content.role;
  }
  if (item.type === "function_call") {
    return item.content.name;
  }
  return `→ ${item.content.call_id}`;
}

export function TestItemList({ items }: TestItemListProps) {
  const [openId, setOpenId] = React.useState<string | null>(null);

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const id = item.id ?? `${index}`;
        const expanded = openId === id;
        const direction = getTestItemDirection(item);
        const preview = getPreview(item);
        const metaLabel = getMetaLabel(item);

        return (
          <div key={id} className="rounded-lg border bg-muted/30">
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
              onClick={() =>
                setOpenId((current) => (current === id ? null : id))
              }
            >
              <span className="text-xs text-muted-foreground">#{index}</span>
              <Badge
                className={cn(
                  "border-none",
                  direction === "INPUT"
                    ? "bg-blue-500/10 text-blue-700 dark:text-blue-200"
                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                )}
              >
                {direction}
              </Badge>
              <Badge variant="secondary">{item.type}</Badge>
              <span className="text-sm font-medium">{metaLabel}</span>
              <span className="flex-1 truncate text-sm text-muted-foreground">
                {preview}
              </span>
              <ChevronDown
                className={cn(
                  "size-4 text-muted-foreground transition",
                  expanded && "rotate-180"
                )}
              />
            </button>
            {expanded ? (
              <div className="space-y-2 border-t px-4 py-3 text-sm">
                {item.type === "message" ? (
                  <div className="whitespace-pre-wrap">
                    {item.content.any_content
                      ? "<any content>"
                      : item.content.content}
                  </div>
                ) : null}
                {item.type === "anthropic_system" ? (
                  "text" in item.content ? (
                    <div className="whitespace-pre-wrap">
                      {item.content.text}
                    </div>
                  ) : (
                    renderBlocks(item.content.blocks)
                  )
                ) : null}
                {item.type === "anthropic_message" ? (
                  typeof item.content.content === "string" ? (
                    <div className="whitespace-pre-wrap">
                      {item.content.content}
                    </div>
                  ) : (
                    renderBlocks(item.content.content)
                  )
                ) : null}
                {item.type === "function_call" ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Call ID: {item.content.call_id}
                    </p>
                    <pre className="whitespace-pre-wrap rounded-md bg-background p-3 text-xs">
                      {formatJson(item.content.arguments)}
                    </pre>
                  </div>
                ) : null}
                {item.type === "function_call_output" ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Call ID: {item.content.call_id}
                    </p>
                    <pre className="whitespace-pre-wrap rounded-md bg-background p-3 text-xs">
                      {formatJson(item.content.output)}
                    </pre>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
