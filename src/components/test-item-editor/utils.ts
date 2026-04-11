import type {
  TestItemDraft,
  TestItemListItem,
} from "@/components/test-item-editor/types";

export type TestItemDirection = "INPUT" | "OUTPUT";

type TestItem = TestItemDraft | TestItemListItem;

function assertNever(value: never): never {
  throw new Error(`Unsupported test item type: ${String(value)}`);
}

export function getTestItemDirection(item: TestItem): TestItemDirection {
  switch (item.type) {
    case "message":
      return item.content.role === "assistant" ? "OUTPUT" : "INPUT";
    case "anthropic_system":
      return "INPUT";
    case "anthropic_message":
      return item.content.role === "assistant" ? "OUTPUT" : "INPUT";
    case "function_call":
      return "OUTPUT";
    case "function_call_output":
      return "INPUT";
    default:
      return assertNever(item);
  }
}
