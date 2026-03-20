import type { TestItem } from "@prisma/client";
import type {
  FunctionCallContent,
  FunctionCallOutputContent,
  MessageContent,
  TestItemDraft,
  TestItemListItem,
} from "@/components/test-item-editor/types";

type PrismaTestItem = Pick<TestItem, "id" | "type" | "content">;

export function mapPrismaItemsToListItems(
  items: PrismaTestItem[]
): TestItemListItem[] {
  return items.map((item) => {
    if (item.type === "message") {
      return {
        id: item.id,
        type: "message",
        content: item.content as MessageContent,
      };
    }
    if (item.type === "function_call") {
      return {
        id: item.id,
        type: "function_call",
        content: item.content as FunctionCallContent,
      };
    }
    if (item.type === "function_call_output") {
      return {
        id: item.id,
        type: "function_call_output",
        content: item.content as FunctionCallOutputContent,
      };
    }
    throw new Error("Unsupported test item type");
  });
}

export function mapPrismaItemsToDrafts(
  items: PrismaTestItem[],
  createClientId: () => string
): TestItemDraft[] {
  return items.map((item) => {
    const clientId = createClientId();
    if (item.type === "message") {
      return {
        clientId,
        type: "message",
        content: item.content as MessageContent,
      };
    }
    if (item.type === "function_call") {
      return {
        clientId,
        type: "function_call",
        content: item.content as FunctionCallContent,
      };
    }
    if (item.type === "function_call_output") {
      return {
        clientId,
        type: "function_call_output",
        content: item.content as FunctionCallOutputContent,
      };
    }
    throw new Error("Unsupported test item type");
  });
}
