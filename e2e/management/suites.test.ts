import { describe, expect, it } from "vitest";
import type { User } from "@prisma/client";
import { authenticatedFetch, createTestUser } from "../helpers/auth";
import { jsonRequest, managementUrl } from "../helpers/api";
import { prisma } from "../helpers/prisma";

const defaultOrg = { name: "Acme", slug: "acme" };
const defaultSuite = { name: "suite-alpha", description: "Alpha" };

async function createOrg(user: User, payload = defaultOrg) {
  const response = await authenticatedFetch(
    managementUrl("/orgs"),
    {
      method: "POST",
      ...jsonRequest(payload),
    },
    user
  );
  const body = await response.json();
  return { response, body };
}

async function createSuite(user: User, orgId: string, payload = defaultSuite) {
  const response = await authenticatedFetch(
    managementUrl(`/orgs/${orgId}/suites`),
    {
      method: "POST",
      ...jsonRequest(payload),
    },
    user
  );
  const body = await response.json();
  return { response, body };
}

describe("management api test suites", () => {
  it("creates a test suite for admins", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin);

    const { response, body } = await createSuite(admin, org.id);
    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      org_id: org.id,
      name: defaultSuite.name,
      description: defaultSuite.description,
    });
  });

  it("allows members to create test suites", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const { body: org } = await createOrg(admin);

    await prisma.orgMembership.create({
      data: { orgId: org.id, userId: member.id, role: "member" },
    });

    const { response } = await createSuite(member, org.id, {
      name: "suite-member",
    });
    expect(response.status).toBe(201);
  });

  it("returns 404 when creating a suite without membership", async () => {
    const admin = await createTestUser();
    const outsider = await createTestUser();
    const { body: org } = await createOrg(admin);

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/suites`),
      {
        method: "POST",
        ...jsonRequest({ name: "suite-outside" }),
      },
      outsider
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "not_found" });
  });

  it("rejects duplicate suite names", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin);
    await createSuite(admin, org.id);

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/suites`),
      {
        method: "POST",
        ...jsonRequest(defaultSuite),
      },
      admin
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toMatchObject({
      code: "conflict",
      type: "conflict_error",
    });
  });

  it("lists suites for the organization", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin);
    await createSuite(admin, org.id, { name: "suite-one" });
    await createSuite(admin, org.id, { name: "suite-two" });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/suites`),
      {},
      admin
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(2);
    expect(body.map((item: { name: string }) => item.name).sort()).toEqual([
      "suite-one",
      "suite-two",
    ]);
  });

  it("allows members to list suites", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const { body: org } = await createOrg(admin);
    await createSuite(admin, org.id, { name: "suite-alpha" });

    await prisma.orgMembership.create({
      data: { orgId: org.id, userId: member.id, role: "member" },
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/suites`),
      {},
      member
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(1);
  });

  it("gets suite details", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin);
    const { body: suite } = await createSuite(admin, org.id);

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/suites/${suite.id}`),
      {},
      admin
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ id: suite.id, org_id: org.id });
  });

  it("returns 404 when suite does not belong to org", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin, { name: "Org", slug: "org" });
    const { body: otherOrg } = await createOrg(admin, {
      name: "Other",
      slug: "other",
    });
    const { body: suite } = await createSuite(admin, otherOrg.id, {
      name: "suite-elsewhere",
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/suites/${suite.id}`),
      {},
      admin
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "not_found" });
  });

  it("updates suite metadata", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin);
    const { body: suite } = await createSuite(admin, org.id);

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/suites/${suite.id}`),
      {
        method: "PATCH",
        ...jsonRequest({ name: "suite-renamed", description: "Updated" }),
      },
      admin
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ name: "suite-renamed", description: "Updated" });
  });

  it("rejects suite renames that conflict", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin);
    const { body: suite } = await createSuite(admin, org.id, { name: "suite-a" });
    await createSuite(admin, org.id, { name: "suite-b" });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/suites/${suite.id}`),
      {
        method: "PATCH",
        ...jsonRequest({ name: "suite-b" }),
      },
      admin
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "conflict" });
  });

  it("validates suite update payloads", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin);
    const { body: suite } = await createSuite(admin, org.id);

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/suites/${suite.id}`),
      {
        method: "PATCH",
        ...jsonRequest({ name: "" }),
      },
      admin
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "invalid_request" });
  });

  it("deletes suites", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin);
    const { body: suite } = await createSuite(admin, org.id);

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/suites/${suite.id}`),
      { method: "DELETE" },
      admin
    );

    expect(response.status).toBe(204);
    const listResponse = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/suites`),
      {},
      admin
    );
    const listBody = await listResponse.json();
    expect(listBody).toEqual([]);
  });

  it("returns 404 when deleting a suite outside the org", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin, { name: "Org", slug: "org" });
    const { body: otherOrg } = await createOrg(admin, {
      name: "Other",
      slug: "other",
    });
    const { body: suite } = await createSuite(admin, otherOrg.id, {
      name: "suite-elsewhere",
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/suites/${suite.id}`),
      { method: "DELETE" },
      admin
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "not_found" });
  });
});
