"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ItemContentFields } from "@/components/test-item-editor/item-content-fields";
import type { TestItemDraft } from "@/components/test-item-editor/types";

type TestItemRowProps = {
  item: TestItemDraft;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  disableRemove: boolean;
  onChange: (item: TestItemDraft) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
};

function getDirection(item: TestItemDraft) {
  if (item.type === "message") {
    return item.content.role === "assistant" ? "OUTPUT" : "INPUT";
  }
  return item.type === "function_call" ? "OUTPUT" : "INPUT";
}

function getDefaultContent(type: TestItemDraft["type"]): TestItemDraft {
  const clientId = crypto.randomUUID();
  if (type === "message") {
    return {
      type,
      clientId,
      content: { role: "user", content: "" },
    };
  }
  if (type === "function_call") {
    return {
      type,
      clientId,
      content: { call_id: "", name: "", arguments: "" },
    };
  }
  return {
    type,
    clientId,
    content: { call_id: "", output: "" },
  };
}

export function TestItemRow({
  item,
  index,
  isFirst,
  isLast,
  disableRemove,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: TestItemRowProps) {
  const direction = getDirection(item);

  const borderClass =
    direction === "INPUT" ? "border-l-blue-500" : "border-l-emerald-500";

  const handleTypeChange = (value: TestItemDraft["type"]) => {
    if (value === item.type) return;
    const nextItem = getDefaultContent(value);
    onChange({ ...nextItem, clientId: item.clientId });
  };

  const removeButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onRemove}
      disabled={disableRemove}
    >
      <Trash2 className="size-4" />
    </Button>
  );

  return (
    <div
      className={cn(
        "space-y-4 rounded-lg border border-l-4 bg-muted/50 p-4",
        borderClass
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
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
        <div className="min-w-[180px]">
          <Select
            value={item.type}
            onValueChange={(value) =>
              handleTypeChange(value as TestItemDraft["type"])
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="message">message</SelectItem>
              <SelectItem value="function_call">function_call</SelectItem>
              <SelectItem value="function_call_output">
                function_call_output
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onMoveUp}
            disabled={isFirst}
          >
            <ArrowUp className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onMoveDown}
            disabled={isLast}
          >
            <ArrowDown className="size-4" />
          </Button>
          {disableRemove ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>{removeButton}</span>
              </TooltipTrigger>
              <TooltipContent>At least one item required</TooltipContent>
            </Tooltip>
          ) : (
            removeButton
          )}
        </div>
      </div>
      <ItemContentFields item={item} onChange={onChange} />
    </div>
  );
}
