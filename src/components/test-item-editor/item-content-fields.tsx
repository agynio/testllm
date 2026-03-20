"use client";

import * as React from "react";
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
  MessageContent,
  TestItemDraft,
} from "@/components/test-item-editor/types";

type ItemContentFieldsProps = {
  item: TestItemDraft;
  onChange: (item: TestItemDraft) => void;
};

export function ItemContentFields({ item, onChange }: ItemContentFieldsProps) {
  if (item.type === "message") {
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
                    role: value as MessageContent["role"],
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
          <Label>Content</Label>
          <Textarea
            value={item.content.content}
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
