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
  MessageContent,
  TestItemDraft,
} from "@/components/test-item-editor/types";

type ItemContentFieldsProps = {
  item: TestItemDraft;
  onChange: (item: TestItemDraft) => void;
};

export function ItemContentFields({ item, onChange }: ItemContentFieldsProps) {
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
