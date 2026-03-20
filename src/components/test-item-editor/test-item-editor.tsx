"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TestItemRow } from "@/components/test-item-editor/test-item-row";
import type { TestItemDraft } from "@/components/test-item-editor/types";

type TestItemEditorProps = {
  initialItems?: TestItemDraft[];
  inputName: string;
};

function createMessageItem(): TestItemDraft {
  return {
    type: "message",
    clientId: crypto.randomUUID(),
    content: { role: "user", content: "" },
  };
}

function createFunctionCallItem(): TestItemDraft {
  return {
    type: "function_call",
    clientId: crypto.randomUUID(),
    content: { call_id: "", name: "", arguments: "" },
  };
}

function createFunctionCallOutputItem(): TestItemDraft {
  return {
    type: "function_call_output",
    clientId: crypto.randomUUID(),
    content: { call_id: "", output: "" },
  };
}

export function TestItemEditor({
  initialItems,
  inputName,
}: TestItemEditorProps) {
  const [items, setItems] = React.useState<TestItemDraft[]>(() => {
    if (initialItems && initialItems.length > 0) return initialItems;
    return [createMessageItem()];
  });

  const serializedItems = React.useMemo(
    () =>
      JSON.stringify(
        items.map((item) => ({ type: item.type, content: item.content }))
      ),
    [items]
  );

  const updateItem = (index: number, updated: TestItemDraft) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? updated : item
      )
    );
  };

  const moveItem = (from: number, to: number) => {
    setItems((current) => {
      const next = [...current];
      const [removed] = next.splice(from, 1);
      next.splice(to, 0, removed);
      return next;
    });
  };

  const removeItem = (index: number) => {
    setItems((current) =>
      current.length > 1
        ? current.filter((_, itemIndex) => itemIndex !== index)
        : current
    );
  };

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <TestItemRow
          key={item.clientId}
          item={item}
          index={index}
          isFirst={index === 0}
          isLast={index === items.length - 1}
          disableRemove={items.length === 1}
          onChange={(updated) => updateItem(index, updated)}
          onMoveUp={() => moveItem(index, index - 1)}
          onMoveDown={() => moveItem(index, index + 1)}
          onRemove={() => removeItem(index)}
        />
      ))}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setItems((current) => [...current, createMessageItem()])}
        >
          <Plus className="size-4" /> Add Message
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setItems((current) => [...current, createFunctionCallItem()])
          }
        >
          <Plus className="size-4" /> Add Function Call
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setItems((current) => [...current, createFunctionCallOutputItem()])
          }
        >
          <Plus className="size-4" /> Add Output
        </Button>
      </div>

      <input name={inputName} type="hidden" value={serializedItems} />
    </div>
  );
}
