import { describe, expect, it } from "vitest";
import { jsonRequest, responsesUrl } from "../helpers/api";
import { prisma } from "../helpers/prisma";
import {
  multiOutputSequence,
  simpleMessageSequence,
  TestItemFixture,
  weatherSequence,
  withPositions,
} from "../helpers/fixtures";

async function seedResponseTest({
  orgSlug = "acme",
  suiteName = "default",
  testName = "simple",
  items = simpleMessageSequence,
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
    data: { orgId: org.id, name: suiteName },
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

describe("responses api", () => {
  it("returns org_not_found when org is missing", async () => {
    const response = await fetch(responsesUrl("missing", "suite"), {
      method: "POST",
      ...jsonRequest({ model: "test", input: "Hello" }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "org_not_found" });
  });

  it("returns suite_not_found when suite is missing", async () => {
    const org = await prisma.organization.create({
      data: { name: "Acme", slug: "acme" },
    });

    const response = await fetch(responsesUrl(org.slug, "missing"), {
      method: "POST",
      ...jsonRequest({ model: "test", input: "Hello" }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "suite_not_found" });
  });

  it("returns model_not_found when test is missing", async () => {
    const org = await prisma.organization.create({
      data: { name: "Acme", slug: "acme" },
    });
    const suite = await prisma.testSuite.create({
      data: { orgId: org.id, name: "default" },
    });

    const response = await fetch(responsesUrl(org.slug, suite.name), {
      method: "POST",
      ...jsonRequest({ model: "missing", input: "Hello" }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "model_not_found" });
  });

  it("returns invalid_json for malformed payloads", async () => {
    const response = await fetch(responsesUrl("acme", "default"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json}",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "invalid_json" });
  });

  it("returns missing_model when model is absent", async () => {
    const response = await fetch(responsesUrl("acme", "default"), {
      method: "POST",
      ...jsonRequest({ input: "Hello" }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "missing_model" });
  });

  it("returns missing_input when input is absent", async () => {
    const response = await fetch(responsesUrl("acme", "default"), {
      method: "POST",
      ...jsonRequest({ model: "test" }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "missing_input" });
  });

  it("validates input payload types", async () => {
    const response = await fetch(responsesUrl("acme", "default"), {
      method: "POST",
      ...jsonRequest({ model: "test", input: 123 }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "invalid_request" });
  });

  it("normalizes string input into a user message", async () => {
    const { org, suite, test } = await seedResponseTest({});

    const response = await fetch(responsesUrl(org.slug, suite.name), {
      method: "POST",
      ...jsonRequest({ model: test.name, input: "Hello there" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.output).toHaveLength(1);
    expect(body.output[0]).toMatchObject({
      type: "message",
      role: "assistant",
      status: "completed",
    });
    expect(body.output[0].content[0]).toMatchObject({
      type: "output_text",
      text: "Hi! How can I help?",
      annotations: [],
    });
  });

  it("matches array input items", async () => {
    const { org, suite, test } = await seedResponseTest({});

    const response = await fetch(responsesUrl(org.slug, suite.name), {
      method: "POST",
      ...jsonRequest({
        model: test.name,
        input: [{ role: "user", content: "Hello there" }],
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.output).toHaveLength(1);
  });

  it("supports multi-turn conversations", async () => {
    const { org, suite, test } = await seedResponseTest({
      items: weatherSequence,
      testName: "weather",
    });

    const firstResponse = await fetch(responsesUrl(org.slug, suite.name), {
      method: "POST",
      ...jsonRequest({
        model: test.name,
        input: [
          { role: "system", content: "You are a weather assistant." },
          { role: "user", content: "What is the weather in SF?" },
        ],
      }),
    });

    expect(firstResponse.status).toBe(200);
    const firstBody = await firstResponse.json();
    expect(firstBody.output).toHaveLength(1);
    expect(firstBody.output[0].type).toBe("function_call");

    const secondResponse = await fetch(responsesUrl(org.slug, suite.name), {
      method: "POST",
      ...jsonRequest({
        model: test.name,
        input: [
          { role: "system", content: "You are a weather assistant." },
          { role: "user", content: "What is the weather in SF?" },
          {
            type: "function_call",
            call_id: "call_weather",
            name: "get_weather",
            arguments: "{\"city\":\"SF\"}",
          },
          {
            type: "function_call_output",
            call_id: "call_weather",
            output: "{\"temp\":65}",
          },
        ],
      }),
    });

    expect(secondResponse.status).toBe(200);
    const secondBody = await secondResponse.json();
    expect(secondBody.output).toHaveLength(1);
    expect(secondBody.output[0].type).toBe("message");
  });

  it("returns multiple output items in one response", async () => {
    const { org, suite, test } = await seedResponseTest({
      items: multiOutputSequence,
      testName: "multi-output",
    });

    const response = await fetch(responsesUrl(org.slug, suite.name), {
      method: "POST",
      ...jsonRequest({
        model: test.name,
        input: [{ role: "user", content: "Run the workflow" }],
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.output).toHaveLength(2);
    expect(body.output.map((item: { type: string }) => item.type)).toEqual([
      "function_call",
      "message",
    ]);
  });

  it("formats function_call outputs in OpenAI format", async () => {
    const { org, suite, test } = await seedResponseTest({
      items: weatherSequence,
      testName: "weather-format",
    });

    const response = await fetch(responsesUrl(org.slug, suite.name), {
      method: "POST",
      ...jsonRequest({
        model: test.name,
        input: [
          { role: "system", content: "You are a weather assistant." },
          { role: "user", content: "What is the weather in SF?" },
        ],
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.output).toHaveLength(1);
    expect(body.output[0]).toMatchObject({
      type: "function_call",
      call_id: "call_weather",
      name: "get_weather",
      arguments: "{\"city\":\"SF\"}",
      status: "completed",
    });
    expect(body.output[0].id).toMatch(/^fc_/);
  });

  it("returns input_mismatch for content differences", async () => {
    const { org, suite, test } = await seedResponseTest({});

    const response = await fetch(responsesUrl(org.slug, suite.name), {
      method: "POST",
      ...jsonRequest({
        model: test.name,
        input: [{ role: "user", content: "Wrong" }],
      }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "input_mismatch" });
    expect(body.error.message).toContain("expected message");
  });

  it("returns input_mismatch for function_call mismatches", async () => {
    const { org, suite, test } = await seedResponseTest({
      items: weatherSequence,
      testName: "weather-mismatch",
    });

    const response = await fetch(responsesUrl(org.slug, suite.name), {
      method: "POST",
      ...jsonRequest({
        model: test.name,
        input: [
          { role: "system", content: "You are a weather assistant." },
          { role: "user", content: "What is the weather in SF?" },
          {
            type: "function_call",
            call_id: "wrong-call",
            name: "get_weather",
            arguments: "{\"city\":\"SF\"}",
          },
          {
            type: "function_call_output",
            call_id: "call_weather",
            output: "{\"temp\":65}",
          },
        ],
      }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "input_mismatch" });
    expect(body.error.message).toContain("function_call");
  });

  it("returns sequence_exhausted when input extends past the sequence", async () => {
    const { org, suite, test } = await seedResponseTest({});

    const response = await fetch(responsesUrl(org.slug, suite.name), {
      method: "POST",
      ...jsonRequest({
        model: test.name,
        input: [
          { role: "user", content: "Hello there" },
          { role: "user", content: "Extra" },
        ],
      }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "sequence_exhausted" });
  });

  it("returns input_mismatch when input is shorter than expected", async () => {
    const inputOnlySequence: TestItemFixture[] = [
      {
        type: "message",
        content: { role: "user", content: "First" },
      },
      {
        type: "message",
        content: { role: "user", content: "Second" },
      },
    ];

    const { org, suite, test } = await seedResponseTest({
      items: inputOnlySequence,
      testName: "input-only",
    });

    const response = await fetch(responsesUrl(org.slug, suite.name), {
      method: "POST",
      ...jsonRequest({
        model: test.name,
        input: [{ role: "user", content: "First" }],
      }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "input_mismatch" });
  });
});
