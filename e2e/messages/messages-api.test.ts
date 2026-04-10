import { describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { setTimeout as delay } from "timers/promises";
import { jsonRequest, messagesRunUrl, messagesUrl } from "../helpers/api";
import { prisma } from "../helpers/prisma";
import {
  anthropicSimpleSequence,
  anthropicToolSequence,
  TestItemFixture,
  withPositions,
} from "../helpers/fixtures";

async function readSseEvents(response: Response) {
  const text = await response.text();

  return text
    .trim()
    .split("\n\n")
    .filter(Boolean)
    .map((chunk) => {
      const lines = chunk.split("\n");
      const eventLine = lines.find((line) => line.startsWith("event: "));
      const dataLine = lines.find((line) => line.startsWith("data: "));

      if (!eventLine || !dataLine) {
        throw new Error("Invalid SSE frame");
      }

      return {
        event: eventLine.slice("event: ".length),
        data: JSON.parse(dataLine.slice("data: ".length)),
      };
    });
}

async function seedMessageTest({
  orgSlug = "acme",
  suiteName = "messages",
  testName = "simple",
  items = anthropicSimpleSequence,
}: {
  orgSlug?: string;
  suiteName?: string;
  testName?: string;
  items?: ReadonlyArray<TestItemFixture>;
}) {
  const org = await prisma.organization.create({
    data: { name: "Acme", slug: orgSlug },
  });
  const suite = await prisma.testSuite.create({
    data: { orgId: org.id, name: suiteName, protocol: "anthropic" },
  });
  const test = await prisma.test.create({
    data: { testSuiteId: suite.id, name: testName },
  });

  await prisma.testItem.createMany({
    data: withPositions(items).map((item) => ({
      ...item,
      testId: test.id,
    })),
  });

  return { org, suite, test };
}

async function waitForResponseLogs(runId: string, expectedCount: number) {
  const deadline = Date.now() + 5000;

  while (Date.now() < deadline) {
    const count = await prisma.responseLog.count({ where: { runId } });
    if (count >= expectedCount) return;
    await delay(50);
  }

  throw new Error("Timed out waiting for response logs");
}

describe("messages api", () => {
  it("returns org_not_found when org is missing", async () => {
    const response = await fetch(messagesUrl("missing", "suite"), {
      method: "POST",
      ...jsonRequest({
        model: "test",
        max_tokens: 10,
        messages: [{ role: "user", content: "Hello" }],
      }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatchObject({ type: "not_found_error" });
  });

  it("returns suite_not_found when suite is missing", async () => {
    const org = await prisma.organization.create({
      data: { name: "Acme", slug: "acme" },
    });

    const response = await fetch(messagesUrl(org.slug, "missing"), {
      method: "POST",
      ...jsonRequest({
        model: "test",
        max_tokens: 10,
        messages: [{ role: "user", content: "Hello" }],
      }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatchObject({ type: "not_found_error" });
  });

  it("returns model_not_found when test is missing", async () => {
    const org = await prisma.organization.create({
      data: { name: "Acme", slug: "acme" },
    });
    const suite = await prisma.testSuite.create({
      data: { orgId: org.id, name: "default", protocol: "anthropic" },
    });

    const response = await fetch(messagesUrl(org.slug, suite.name), {
      method: "POST",
      ...jsonRequest({
        model: "missing",
        max_tokens: 10,
        messages: [{ role: "user", content: "Hello" }],
      }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatchObject({ type: "not_found_error" });
  });

  it("returns invalid_request_error for malformed JSON", async () => {
    const response = await fetch(messagesUrl("acme", "default"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json}",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatchObject({ type: "invalid_request_error" });
  });

  it("returns missing field errors", async () => {
    const missingModel = await fetch(messagesUrl("acme", "default"), {
      method: "POST",
      ...jsonRequest({ max_tokens: 10, messages: [] }),
    });
    expect(missingModel.status).toBe(400);

    const missingMaxTokens = await fetch(messagesUrl("acme", "default"), {
      method: "POST",
      ...jsonRequest({ model: "test", messages: [] }),
    });
    expect(missingMaxTokens.status).toBe(400);

    const missingMessages = await fetch(messagesUrl("acme", "default"), {
      method: "POST",
      ...jsonRequest({ model: "test", max_tokens: 10 }),
    });
    expect(missingMessages.status).toBe(400);
  });

  it("matches a simple message and returns Anthropic format", async () => {
    const { org, suite, test } = await seedMessageTest({});

    const response = await fetch(messagesUrl(org.slug, suite.name), {
      method: "POST",
      ...jsonRequest({
        model: test.name,
        max_tokens: 10,
        system: "You are helpful.",
        messages: [{ role: "user", content: "Hello there" }],
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      type: "message",
      role: "assistant",
      model: test.name,
      stop_reason: "end_turn",
    });
    expect(body.content[0]).toMatchObject({ type: "text" });
  });

  it("supports multi-turn tool use", async () => {
    const { org, suite, test } = await seedMessageTest({
      items: anthropicToolSequence,
      testName: "tool-flow",
    });

    const firstResponse = await fetch(messagesUrl(org.slug, suite.name), {
      method: "POST",
      ...jsonRequest({
        model: test.name,
        max_tokens: 10,
        system: "You are a weather assistant.",
        messages: [{ role: "user", content: "Weather in SF?" }],
      }),
    });

    expect(firstResponse.status).toBe(200);
    const firstBody = await firstResponse.json();
    expect(firstBody.stop_reason).toBe("tool_use");
    expect(firstBody.content[0]).toMatchObject({ type: "tool_use" });

    const secondResponse = await fetch(messagesUrl(org.slug, suite.name), {
      method: "POST",
      ...jsonRequest({
        model: test.name,
        max_tokens: 10,
        system: "You are a weather assistant.",
        messages: [
          { role: "user", content: "Weather in SF?" },
          {
            role: "assistant",
            content: [
              {
                type: "tool_use",
                id: "toolu_01",
                name: "get_weather",
                input: { city: "SF" },
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: "toolu_01",
                content: "65F",
              },
            ],
          },
        ],
      }),
    });

    expect(secondResponse.status).toBe(200);
    const secondBody = await secondResponse.json();
    expect(secondBody.stop_reason).toBe("end_turn");
    expect(secondBody.content[0]).toMatchObject({ type: "text" });
  });

  it("streams messages as SSE", async () => {
    const { org, suite, test } = await seedMessageTest({});

    const response = await fetch(messagesUrl(org.slug, suite.name), {
      method: "POST",
      ...jsonRequest({
        model: test.name,
        max_tokens: 10,
        stream: true,
        system: "You are helpful.",
        messages: [{ role: "user", content: "Hello there" }],
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain(
      "text/event-stream"
    );

    const events = await readSseEvents(response);
    expect(events.map((event) => event.event)).toEqual([
      "message_start",
      "content_block_start",
      "content_block_delta",
      "content_block_stop",
      "message_delta",
      "message_stop",
    ]);

    events.forEach(({ event, data }) => {
      expect(data.type).toBe(event);
    });
  });

  it("records response logs for run tracking", async () => {
    const { org, suite, test } = await seedMessageTest({
      testName: "run-test",
    });
    const runId = randomUUID();

    const response = await fetch(
      messagesRunUrl(org.slug, suite.name, runId, "client-run"),
      {
        method: "POST",
        ...jsonRequest({
          model: test.name,
          max_tokens: 10,
          system: "You are helpful.",
          messages: [{ role: "user", content: "Hello there" }],
        }),
      }
    );

    expect(response.status).toBe(200);
    await waitForResponseLogs(runId, 1);

    const log = await prisma.responseLog.findFirst({ where: { runId } });
    expect(log).toBeTruthy();
    expect(log?.status).toBe("success");
  });
});
