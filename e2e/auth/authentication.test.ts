import { describe, expect, it } from "vitest";
import { managementUrl, responsesUrl, jsonRequest } from "../helpers/api";
import { authCookie, createTestUser } from "../helpers/auth";
import { prisma } from "../helpers/prisma";
import {
  simpleMessageSequence,
  withPositions,
} from "../helpers/fixtures";

describe("authentication boundaries", () => {
  it("returns 401 for unauthenticated management requests", async () => {
    const response = await fetch(managementUrl("/orgs"));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toMatchObject({
      code: "unauthorized",
      type: "auth_error",
    });
  });

  it("returns 401 for invalid session cookies", async () => {
    const response = await fetch(managementUrl("/orgs"), {
      headers: {
        Cookie: "authjs.session-token=invalid",
      },
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toMatchObject({
      code: "unauthorized",
      type: "auth_error",
    });
  });

  it("accepts valid Auth.js cookies", async () => {
    const user = await createTestUser();
    const cookie = await authCookie(user);

    const response = await fetch(managementUrl("/orgs"), {
      headers: {
        Cookie: cookie,
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual([]);
  });

  it("allows Responses API calls without auth", async () => {
    const org = await prisma.organization.create({
      data: { name: "Acme", slug: "acme" },
    });
    const suite = await prisma.testSuite.create({
      data: { orgId: org.id, name: "default" },
    });
    const test = await prisma.test.create({
      data: { testSuiteId: suite.id, name: "simple" },
    });

    await prisma.testItem.createMany({
      data: withPositions(simpleMessageSequence).map((item) => ({
        ...item,
        testId: test.id,
      })),
    });

    const response = await fetch(responsesUrl(org.slug, suite.name), {
      method: "POST",
      ...jsonRequest({
        model: test.name,
        input: [{ role: "user", content: "Hello there" }],
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("completed");
    expect(body.output).toHaveLength(1);
    expect(body.output[0]).toMatchObject({
      type: "message",
      role: "assistant",
      status: "completed",
    });
    expect(body.output[0].content[0].text).toBe("Hi! How can I help?");
  });
});
