import type { Protocol } from "@prisma/client";

type ProtocolMeta = {
  label: string;
  endpointPath: "responses" | "messages";
  endpointTitle: string;
};

function assertNever(value: never): never {
  throw new Error(`Unsupported protocol: ${String(value)}`);
}

export function getProtocolMeta(protocol: Protocol): ProtocolMeta {
  switch (protocol) {
    case "openai":
      return {
        label: "OpenAI",
        endpointPath: "responses",
        endpointTitle: "Responses API Endpoint",
      };
    case "anthropic":
      return {
        label: "Anthropic",
        endpointPath: "messages",
        endpointTitle: "Messages API Endpoint",
      };
    default:
      return assertNever(protocol);
  }
}
