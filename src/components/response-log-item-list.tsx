import { Badge } from "@/components/ui/badge";

export type ResponseLogItem =
  | {
      id: string;
      type: "message";
      role: string;
      content: string;
    }
  | {
      id: string;
      type: "function_call";
      callId: string;
      name: string;
      arguments: string;
    }
  | {
      id: string;
      type: "function_call_output";
      callId: string;
      output: string;
    };

type ResponseLogItemListProps = {
  items: ResponseLogItem[];
  emptyLabel?: string;
};

function formatJson(value: string) {
  try {
    const parsed = JSON.parse(value);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
}

export function ResponseLogItemList({
  items,
  emptyLabel,
}: ResponseLogItemListProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {emptyLabel ?? "No items recorded."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{item.type}</Badge>
            {item.type === "message" ? (
              <Badge variant="outline">{item.role}</Badge>
            ) : null}
            {item.type === "function_call" ? (
              <span className="text-sm font-medium">{item.name}</span>
            ) : null}
            {item.type !== "message" ? (
              <span className="text-xs text-muted-foreground">
                Call ID: {item.callId}
              </span>
            ) : null}
          </div>
          <div className="mt-3 text-sm">
            {item.type === "message" ? (
              <div className="whitespace-pre-wrap">{item.content}</div>
            ) : null}
            {item.type === "function_call" ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Arguments</p>
                <pre className="whitespace-pre-wrap rounded-md bg-background p-3 text-xs">
                  {formatJson(item.arguments)}
                </pre>
              </div>
            ) : null}
            {item.type === "function_call_output" ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Output</p>
                <pre className="whitespace-pre-wrap rounded-md bg-background p-3 text-xs">
                  {formatJson(item.output)}
                </pre>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
