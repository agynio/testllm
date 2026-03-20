import { describe, expect, it } from "vitest";
import { authenticatedFetch, createTestUser } from "../helpers/auth";
import { jsonRequest, managementUrl } from "../helpers/api";
import { createOrg, defaultOrgPayload } from "../helpers/management";
import { prisma } from "../helpers/prisma";

describe("management api organizations", () => {
  it("creates an organization and assigns admin membership", async () => {
    const user = await createTestUser();
    const { response, body } = await createOrg(user);

    expect(response.status).toBe(201);
    const membership = await prisma.orgMembership.findFirst({
      where: { orgId: body.id, userId: user.id },
    });
    expect(membership?.role).toBe("admin");
  });

  it("rejects duplicate organization slugs", async () => {
    const user = await createTestUser();
    await createOrg(user);

    const response = await authenticatedFetch(
      managementUrl("/orgs"),
      {
        method: "POST",
        ...jsonRequest(defaultOrgPayload),
      },
      user
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toMatchObject({
      code: "conflict",
      type: "conflict_error",
    });
  });

  it("validates slug formatting", async () => {
    const user = await createTestUser();
    const response = await authenticatedFetch(
      managementUrl("/orgs"),
      {
        method: "POST",
        ...jsonRequest({ name: "Bad Slug", slug: "Bad Slug" }),
      },
      user
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatchObject({
      code: "invalid_request",
      type: "validation_error",
    });
  });

  it("lists organizations for the authenticated user", async () => {
    const user = await createTestUser();
    const otherUser = await createTestUser();

    const { body: org } = await createOrg(user);
    await createOrg(otherUser, {
      payload: { name: "Other", slug: "other" },
    });

    const response = await authenticatedFetch(managementUrl("/orgs"), {}, user);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: org.id,
      role: "admin",
    });
  });

  it("returns an empty list when the user has no orgs", async () => {
    const user = await createTestUser();
    const response = await authenticatedFetch(managementUrl("/orgs"), {}, user);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual([]);
  });

  it("allows members to fetch organization details", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const { body: org } = await createOrg(admin, {
      payload: {
        name: "Team Alpha",
        slug: "team-alpha",
      },
    });

    await prisma.orgMembership.create({
      data: {
        orgId: org.id,
        userId: member.id,
        role: "member",
      },
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}`),
      {},
      member
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ id: org.id, name: "Team Alpha" });
  });

  it("returns 404 when a non-member fetches an org", async () => {
    const admin = await createTestUser();
    const outsider = await createTestUser();
    const { body: org } = await createOrg(admin);

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}`),
      {},
      outsider
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatchObject({
      code: "not_found",
      type: "not_found_error",
    });
  });

  it("updates organization metadata for admins", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin);

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}`),
      {
        method: "PATCH",
        ...jsonRequest({ name: "Renamed" }),
      },
      admin
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.name).toBe("Renamed");
  });

  it("rejects organization updates from non-admin members", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const { body: org } = await createOrg(admin);

    await prisma.orgMembership.create({
      data: { orgId: org.id, userId: member.id, role: "member" },
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}`),
      {
        method: "PATCH",
        ...jsonRequest({ name: "Blocked" }),
      },
      member
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toMatchObject({
      code: "forbidden",
      type: "auth_error",
    });
  });

  it("returns 404 when updating an org without membership", async () => {
    const admin = await createTestUser();
    const outsider = await createTestUser();
    const { body: org } = await createOrg(admin);

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}`),
      {
        method: "PATCH",
        ...jsonRequest({ name: "Blocked" }),
      },
      outsider
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatchObject({
      code: "not_found",
      type: "not_found_error",
    });
  });

  it("validates organization update payloads", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin);

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}`),
      {
        method: "PATCH",
        ...jsonRequest({ name: "" }),
      },
      admin
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatchObject({
      code: "invalid_request",
      type: "validation_error",
    });
  });

  it("deletes organizations for admins", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin);

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}`),
      { method: "DELETE" },
      admin
    );

    expect(response.status).toBe(204);
    const listResponse = await authenticatedFetch(managementUrl("/orgs"), {}, admin);
    const listBody = await listResponse.json();
    expect(listBody).toEqual([]);
  });

  it("blocks deletion for non-admin members", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const { body: org } = await createOrg(admin);

    await prisma.orgMembership.create({
      data: { orgId: org.id, userId: member.id, role: "member" },
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}`),
      { method: "DELETE" },
      member
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toMatchObject({
      code: "forbidden",
      type: "auth_error",
    });
  });

  it("returns 404 when deleting an org without membership", async () => {
    const admin = await createTestUser();
    const outsider = await createTestUser();
    const { body: org } = await createOrg(admin);

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}`),
      { method: "DELETE" },
      outsider
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatchObject({
      code: "not_found",
      type: "not_found_error",
    });
  });
});
