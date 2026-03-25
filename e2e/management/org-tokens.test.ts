import { describe, expect, it } from "vitest";
import { authenticatedFetch, createTestUser } from "../helpers/auth";
import { jsonRequest, managementUrl } from "../helpers/api";
import { createOrg } from "../helpers/management";
import { prisma } from "../helpers/prisma";
import { createOrgToken, tokenFetch } from "../helpers/tokens";
import { hashTokenRaw } from "@/lib/api-tokens";

describe("management api org tokens", () => {
  it("creates org tokens for admins", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });

    const { response, body } = await createOrgToken(admin, org.id);

    expect(response.status).toBe(201);
    expect(body.token).toMatch(/^tlo_[0-9a-f]{32}$/);
    expect(body.token_prefix).toBe(body.token.slice(0, 8));
  });

  it("creates org tokens with member role", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });

    const { response, body } = await createOrgToken(admin, org.id, {
      payload: { role: "member" },
    });

    expect(response.status).toBe(201);
    expect(body.role).toBe("member");
  });

  it("rejects org token creation from non-admin members", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });

    await prisma.orgMembership.create({
      data: { orgId: org.id, userId: member.id, role: "member" },
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/tokens`),
      {
        method: "POST",
        ...jsonRequest({ name: "Blocked", role: "admin" }),
      },
      member
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "forbidden" });
  });

  it("returns 404 when non-members create org tokens", async () => {
    const admin = await createTestUser();
    const outsider = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/tokens`),
      {
        method: "POST",
        ...jsonRequest({ name: "Blocked", role: "admin" }),
      },
      outsider
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "not_found" });
  });

  it("rejects org token creation without a session", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });
    const { body: token } = await createOrgToken(admin, org.id);

    const response = await tokenFetch(
      managementUrl(`/orgs/${org.id}/tokens`),
      token.token,
      {
        method: "POST",
        ...jsonRequest({ name: "Blocked", role: "admin" }),
      }
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "forbidden" });
  });

  it("validates org token role values", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/tokens`),
      {
        method: "POST",
        ...jsonRequest({ name: "Bad role", role: "owner" }),
      },
      admin
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "invalid_request" });
  });

  it("rejects expired token timestamps", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });
    const expiresAt = new Date(Date.now() - 1000).toISOString();

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/tokens`),
      {
        method: "POST",
        ...jsonRequest({ name: "Expired", role: "admin", expires_at: expiresAt }),
      },
      admin
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "invalid_request" });
  });

  it("lists org tokens for admins", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });

    await createOrgToken(admin, org.id);

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/tokens`),
      {},
      admin
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(1);
  });

  it("isolates org token listings by organization", async () => {
    const admin = await createTestUser();
    const otherAdmin = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });
    const { body: otherOrg } = await createOrg(otherAdmin, { uniqueSlug: true });

    await createOrgToken(admin, org.id);
    await createOrgToken(otherAdmin, otherOrg.id);

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/tokens`),
      {},
      admin
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBeDefined();
  });

  it("rejects token listing from non-admin members", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });

    await prisma.orgMembership.create({
      data: { orgId: org.id, userId: member.id, role: "member" },
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/tokens`),
      {},
      member
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "forbidden" });
  });

  it("deletes org tokens for admins", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });
    const { body: token } = await createOrgToken(admin, org.id);

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/tokens/${token.id}`),
      { method: "DELETE" },
      admin
    );

    expect(response.status).toBe(204);
    const remaining = await prisma.orgApiToken.findMany({ where: { orgId: org.id } });
    expect(remaining).toEqual([]);
  });

  it("returns 404 when deleting tokens from another org", async () => {
    const admin = await createTestUser();
    const otherAdmin = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });
    const { body: otherOrg } = await createOrg(otherAdmin, { uniqueSlug: true });
    const { body: token } = await createOrgToken(otherAdmin, otherOrg.id);

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/tokens/${token.id}`),
      { method: "DELETE" },
      admin
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "not_found" });
  });

  it("rejects org token deletion without a session", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });
    const { body: token } = await createOrgToken(admin, org.id);

    const response = await tokenFetch(
      managementUrl(`/orgs/${org.id}/tokens/${token.id}`),
      token.token,
      { method: "DELETE" }
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "forbidden" });
  });

  it("stores org token hashes instead of raw values", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });
    const { body } = await createOrgToken(admin, org.id);

    const stored = await prisma.orgApiToken.findUnique({ where: { id: body.id } });

    expect(stored).not.toBeNull();
    expect(stored?.tokenHash).toBe(hashTokenRaw(body.token));
    expect(stored?.tokenHash).not.toBe(body.token);
    expect(stored?.tokenPrefix).toBe(body.token_prefix);
  });
});
