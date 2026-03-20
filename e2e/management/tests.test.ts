import { describe, expect, it } from "vitest";
import type { User } from "@prisma/client";
import { authenticatedFetch, createTestUser } from "../helpers/auth";
import { jsonRequest, managementUrl } from "../helpers/api";
import { prisma } from "../helpers/prisma";
import {
  simpleMessageSequence,
  weatherSequence,
} from "../helpers/fixtures";
import { createOrg, createSuite } from "../helpers/management";

async function createTest(
  user: User,
  orgId: string,
  suiteId: string,
  payload: { name: string; description?: string; items: unknown[] }
) {
  const response = await authenticatedFetch(
    managementUrl(`/orgs/${orgId}/suites/${suiteId}/tests`),
    {
      method: "POST",
      ...jsonRequest(payload),
    },
    user
  );
  const body = await response.json();
  return { response, body };
}

describe("management api tests", () => {
  it("creates tests with ordered items", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin);
    const { body: suite } = await createSuite(admin, org.id);

    const { response, body } = await createTest(admin, org.id, suite.id, {
      name: "weather-test",
      description: "Weather scenario",
      items: weatherSequence,
    });

    expect(response.status).toBe(201);
    expect(body.items).toHaveLength(weatherSequence.length);
    expect(body.items.map((item: { position: number }) => item.position)).toEqual(
      weatherSequence.map((_, index) => index)
    );
  });

  it("rejects duplicate test names", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin);
    const { body: suite } = await createSuite(admin, org.id);

    await createTest(admin, org.id, suite.id, {
      name: "duplicate",
      items: simpleMessageSequence,
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/suites/${suite.id}/tests`),
      {
        method: "POST",
        ...jsonRequest({ name: "duplicate", items: simpleMessageSequence }),
      },
      admin
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "conflict" });
  });

  it("returns 404 when creating tests without membership", async () => {
    const admin = await createTestUser();
    const outsider = await createTestUser();
    const { body: org } = await createOrg(admin);
    const { body: suite } = await createSuite(admin, org.id);

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/suites/${suite.id}/tests`),
      {
        method: "POST",
        ...jsonRequest({ name: "nope", items: simpleMessageSequence }),
      },
      outsider
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "not_found" });
  });

  it("lists tests without items", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin);
    const { body: suite } = await createSuite(admin, org.id);

    await createTest(admin, org.id, suite.id, {
      name: "listed",
      items: simpleMessageSequence,
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/suites/${suite.id}/tests`),
      {},
      admin
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].items).toBeUndefined();
  });

  it("returns empty lists when no tests exist", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin);
    const { body: suite } = await createSuite(admin, org.id);

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/suites/${suite.id}/tests`),
      {},
      admin
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual([]);
  });

  it("fetches tests with items", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin);
    const { body: suite } = await createSuite(admin, org.id);
    const { body: test } = await createTest(admin, org.id, suite.id, {
      name: "full",
      items: weatherSequence,
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/suites/${suite.id}/tests/${test.id}`),
      {},
      admin
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(weatherSequence.length);
  });

  it("updates test metadata without replacing items", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin);
    const { body: suite } = await createSuite(admin, org.id);
    const { body: test } = await createTest(admin, org.id, suite.id, {
      name: "metadata",
      items: simpleMessageSequence,
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/suites/${suite.id}/tests/${test.id}`),
      {
        method: "PATCH",
        ...jsonRequest({ name: "metadata-updated" }),
      },
      admin
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.name).toBe("metadata-updated");
    expect(body.items).toHaveLength(simpleMessageSequence.length);
  });

  it("replaces items when updating tests", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin);
    const { body: suite } = await createSuite(admin, org.id);
    const { body: test } = await createTest(admin, org.id, suite.id, {
      name: "replace-items",
      items: simpleMessageSequence,
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/suites/${suite.id}/tests/${test.id}`),
      {
        method: "PATCH",
        ...jsonRequest({ items: weatherSequence }),
      },
      admin
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(weatherSequence.length);
    expect(body.items[0].content.role).toBe("system");
  });

  it("rejects test renames that conflict", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin);
    const { body: suite } = await createSuite(admin, org.id);
    const { body: test } = await createTest(admin, org.id, suite.id, {
      name: "test-a",
      items: simpleMessageSequence,
    });
    await createTest(admin, org.id, suite.id, {
      name: "test-b",
      items: simpleMessageSequence,
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/suites/${suite.id}/tests/${test.id}`),
      {
        method: "PATCH",
        ...jsonRequest({ name: "test-b" }),
      },
      admin
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "conflict" });
  });

  it("validates test update payloads", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin);
    const { body: suite } = await createSuite(admin, org.id);
    const { body: test } = await createTest(admin, org.id, suite.id, {
      name: "invalid-items",
      items: simpleMessageSequence,
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/suites/${suite.id}/tests/${test.id}`),
      {
        method: "PATCH",
        ...jsonRequest({ items: [] }),
      },
      admin
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "invalid_request" });
  });

  it("returns 404 when updating a test outside the org", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin, {
      payload: { name: "Org", slug: "org" },
    });
    const { body: otherOrg } = await createOrg(admin, {
      payload: { name: "Other", slug: "other" },
    });
    const { body: suite } = await createSuite(admin, otherOrg.id, {
      name: "suite-else",
    });
    const { body: test } = await createTest(admin, otherOrg.id, suite.id, {
      name: "foreign",
      items: simpleMessageSequence,
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/suites/${suite.id}/tests/${test.id}`),
      {
        method: "PATCH",
        ...jsonRequest({ name: "blocked" }),
      },
      admin
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "not_found" });
  });

  it("deletes tests", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin);
    const { body: suite } = await createSuite(admin, org.id);
    const { body: test } = await createTest(admin, org.id, suite.id, {
      name: "delete-me",
      items: simpleMessageSequence,
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/suites/${suite.id}/tests/${test.id}`),
      { method: "DELETE" },
      admin
    );

    expect(response.status).toBe(204);
    const remaining = await prisma.test.findMany({ where: { testSuiteId: suite.id } });
    expect(remaining).toEqual([]);
  });

  it("returns 404 when deleting a test outside the org", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin, {
      payload: { name: "Org", slug: "org" },
    });
    const { body: otherOrg } = await createOrg(admin, {
      payload: { name: "Other", slug: "other" },
    });
    const { body: suite } = await createSuite(admin, otherOrg.id, {
      name: "suite-else",
    });
    const { body: test } = await createTest(admin, otherOrg.id, suite.id, {
      name: "foreign",
      items: simpleMessageSequence,
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/suites/${suite.id}/tests/${test.id}`),
      { method: "DELETE" },
      admin
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "not_found" });
  });

  it("returns 404 when fetching a test outside the org", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin, {
      payload: { name: "Org", slug: "org" },
    });
    const { body: otherOrg } = await createOrg(admin, {
      payload: { name: "Other", slug: "other" },
    });
    const { body: suite } = await createSuite(admin, otherOrg.id, {
      name: "suite-else",
    });
    const { body: test } = await createTest(admin, otherOrg.id, suite.id, {
      name: "foreign",
      items: simpleMessageSequence,
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/suites/${suite.id}/tests/${test.id}`),
      {},
      admin
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "not_found" });
  });
});
