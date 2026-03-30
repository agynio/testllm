import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { RelativeTime } from "@/components/relative-time";
import {
  ResponseLogItemList,
  type ResponseLogItem,
} from "@/components/response-log-item-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

type InputTextPart = { type: "input_text"; text: string };
type InputMessageItem = {
  type?: "message";
  role: string;
  content: string | InputTextPart[];
};
type InputFunctionCallItem = {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
};
type InputFunctionCallOutputItem = {
  type: "function_call_output";
  call_id: string;
  output: string;
};

type OutputTextPart = { type: "output_text"; text: string };
type OutputMessageItem = {
  type: "message";
  role: "assistant";
  content: OutputTextPart[];
};
type OutputFunctionCallItem = {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isInputTextPart(value: unknown): value is InputTextPart {
  return (
    isRecord(value) && value.type === "input_text" && typeof value.text === "string"
  );
}

function isInputMessageItem(value: unknown): value is InputMessageItem {
  if (!isRecord(value)) return false;
  if (value.type !== undefined && value.type !== "message") return false;
  if (typeof value.role !== "string") return false;
  const content = value.content;
  if (typeof content === "string") return true;
  if (!Array.isArray(content)) return false;
  return content.every(isInputTextPart);
}

function isInputFunctionCallItem(value: unknown): value is InputFunctionCallItem {
  return (
    isRecord(value) &&
    value.type === "function_call" &&
    typeof value.call_id === "string" &&
    typeof value.name === "string" &&
    typeof value.arguments === "string"
  );
}

function isInputFunctionCallOutputItem(
  value: unknown
): value is InputFunctionCallOutputItem {
  return (
    isRecord(value) &&
    value.type === "function_call_output" &&
    typeof value.call_id === "string" &&
    typeof value.output === "string"
  );
}

function isOutputTextPart(value: unknown): value is OutputTextPart {
  return (
    isRecord(value) && value.type === "output_text" && typeof value.text === "string"
  );
}

function isOutputMessageItem(value: unknown): value is OutputMessageItem {
  if (!isRecord(value)) return false;
  if (value.type !== "message") return false;
  if (value.role !== "assistant") return false;
  if (!Array.isArray(value.content)) return false;
  return value.content.every(isOutputTextPart);
}

function isOutputFunctionCallItem(
  value: unknown
): value is OutputFunctionCallItem {
  return (
    isRecord(value) &&
    value.type === "function_call" &&
    typeof value.call_id === "string" &&
    typeof value.name === "string" &&
    typeof value.arguments === "string"
  );
}

function normalizeInputContent(content: string | InputTextPart[]) {
  if (typeof content === "string") return content;
  return content.map((part) => part.text).join("");
}

function normalizeOutputContent(content: OutputTextPart[]) {
  return content.map((part) => part.text).join("");
}

function parseInputItems(input: unknown): ResponseLogItem[] {
  if (typeof input === "string") {
    return [
      {
        id: "input-0",
        type: "message",
        role: "user",
        content: input,
      },
    ];
  }

  if (!Array.isArray(input)) {
    throw new Error("Unexpected response log input format");
  }

  return input.map((item, index) => {
    if (isInputMessageItem(item)) {
      return {
        id: `input-${index}`,
        type: "message",
        role: item.role,
        content: normalizeInputContent(item.content),
      };
    }
    if (isInputFunctionCallItem(item)) {
      return {
        id: `input-${index}`,
        type: "function_call",
        callId: item.call_id,
        name: item.name,
        arguments: item.arguments,
      };
    }
    if (isInputFunctionCallOutputItem(item)) {
      return {
        id: `input-${index}`,
        type: "function_call_output",
        callId: item.call_id,
        output: item.output,
      };
    }

    throw new Error("Unexpected response log input item");
  });
}

function parseOutputItems(output: unknown): ResponseLogItem[] {
  if (!isRecord(output)) {
    throw new Error("Unexpected response log output format");
  }
  if (!Array.isArray(output.output)) {
    throw new Error("Unexpected response log output format");
  }

  return output.output.map((item, index) => {
    if (isOutputMessageItem(item)) {
      return {
        id: `output-${index}`,
        type: "message",
        role: item.role,
        content: normalizeOutputContent(item.content),
      };
    }
    if (isOutputFunctionCallItem(item)) {
      return {
        id: `output-${index}`,
        type: "function_call",
        callId: item.call_id,
        name: item.name,
        arguments: item.arguments,
      };
    }

    throw new Error("Unexpected response log output item");
  });
}

export default async function LogDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; runId: string; logId: string }>;
  searchParams?: Promise<{ client_test_name?: string | string[] }>;
}) {
  const { orgId, runId, logId } = await params;
  const resolvedSearchParams = await searchParams;
  const clientTestNameParam = resolvedSearchParams?.client_test_name;
  const clientTestName = Array.isArray(clientTestNameParam)
    ? clientTestNameParam[0]
    : clientTestNameParam;
  const normalizedClientTestName = clientTestName?.trim();
  const clientTestNameValue =
    normalizedClientTestName && normalizedClientTestName.length > 0
      ? normalizedClientTestName
      : undefined;

  const run = await prisma.testRun.findUnique({ where: { id: runId } });
  if (!run || run.orgId !== orgId) {
    notFound();
  }

  const log = await prisma.responseLog.findFirst({
    where: { id: logId, runId },
  });
  if (!log) {
    notFound();
  }

  const inputItems = parseInputItems(log.input);
  const outputItems =
    log.status === "success" ? parseOutputItems(log.output) : [];
  const placeholder = "\u2014";

  const backParams = new URLSearchParams();
  if (clientTestNameValue) {
    backParams.set("client_test_name", clientTestNameValue);
  }
  const backHref = `/orgs/${orgId}/runs/${runId}/logs${
    backParams.toString() ? `?${backParams.toString()}` : ""
  }`;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={backHref} className="flex items-center gap-2">
          <ChevronLeft className="size-4" />
          Back to Logs
        </Link>
      </Button>

      <PageHeader title="Log Detail" />

      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">Status</dt>
              <dd>
                <Badge
                  variant={log.status === "error" ? "destructive" : "default"}
                >
                  {log.status === "error" ? "Error" : "Success"}
                </Badge>
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">Suite</dt>
              <dd className="font-mono text-sm">{log.suiteName}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">Model</dt>
              <dd className="text-sm">{log.model}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">Client Test</dt>
              <dd className="font-mono text-sm">{log.clientTestName}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">Duration</dt>
              <dd className="text-sm">{log.durationMs} ms</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">Timestamp</dt>
              <dd>
                <RelativeTime value={log.createdAt} />
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">Response ID</dt>
              <dd className="text-sm font-mono">
                {log.responseId ?? placeholder}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Input</h2>
        <ResponseLogItemList
          items={inputItems}
          emptyLabel="No input recorded."
        />
      </div>

      {log.status === "success" ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Output</h2>
          <ResponseLogItemList
            items={outputItems}
            emptyLabel="No output recorded."
          />
        </div>
      ) : null}

      {log.status === "error" ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>The response log reported a failure.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Error Code</p>
              <p className="font-mono">{log.errorCode ?? placeholder}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Error Message</p>
              <p className="whitespace-pre-wrap">
                {log.errorMessage ?? placeholder}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
