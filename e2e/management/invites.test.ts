import { describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import type { User } from "@prisma/client";
import { authenticatedFetch, createTestUser } from "../helpers/auth";
import { jsonRequest, managementUrl } from "../helpers/api";
import { prisma } from "../helpers/prisma";

async function createOrg(user: User) {
  const slug = `acme-${randomUUID()}`;
  const response = await authenticatedFetch(
    managementUrl("/orgs"),
    {
      method: "POST",
      ...jsonRequest({ name: "Acme", slug }),
    },
    user
  );
  return response.json();
}

async function createInvite(user: User, orgId: string) {
  const response = await authenticatedFetch(
    managementUrl(`/orgs/${orgId}/invites`),
    { method: "POST" },
    user
  );
  const body = await response.json();
  return { response, body };
}

describe("management api invites", () => {
  it("creates invites for admins", async () => {
    const admin = await createTestUser();
    const org = await createOrg(admin);

    const { response, body } = await createInvite(admin, org.id);
    expect(response.status).toBe(201);
    expect(body.url).toContain(`/invite/${body.token}`);
    expect(body.url).toContain("http://localhost:3000");
  });

  it("rejects invite creation from non-admins", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const org = await createOrg(admin);

    await prisma.orgMembership.create({
      data: { orgId: org.id, userId: member.id, role: "member" },
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/invites`),
      { method: "POST" },
      member
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "forbidden" });
  });

  it("lists invites for admins", async () => {
    const admin = await createTestUser();
    const org = await createOrg(admin);
    await createInvite(admin, org.id);

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/invites`),
      {},
      admin
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].url).toContain(`/invite/${body[0].token}`);
  });

  it("rejects invite listing from non-admins", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const org = await createOrg(admin);

    await prisma.orgMembership.create({
      data: { orgId: org.id, userId: member.id, role: "member" },
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/invites`),
      {},
      member
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "forbidden" });
  });

  it("deletes invites for admins", async () => {
    const admin = await createTestUser();
    const org = await createOrg(admin);
    const { body: invite } = await createInvite(admin, org.id);

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/invites/${invite.id}`),
      { method: "DELETE" },
      admin
    );

    expect(response.status).toBe(204);
    const remaining = await prisma.invite.findMany({ where: { orgId: org.id } });
    expect(remaining).toEqual([]);
  });

  it("rejects invite deletion from non-admins", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const org = await createOrg(admin);
    const { body: invite } = await createInvite(admin, org.id);

    await prisma.orgMembership.create({
      data: { orgId: org.id, userId: member.id, role: "member" },
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/invites/${invite.id}`),
      { method: "DELETE" },
      member
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "forbidden" });
  });

  it("returns 404 when deleting invites outside the org", async () => {
    const admin = await createTestUser();
    const otherAdmin = await createTestUser();
    const org = await createOrg(admin);
    const otherOrg = await createOrg(otherAdmin);
    const { body: invite } = await createInvite(otherAdmin, otherOrg.id);

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/invites/${invite.id}`),
      { method: "DELETE" },
      admin
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "not_found" });
  });

  it("accepts invites for authenticated users", async () => {
    const admin = await createTestUser();
    const invitee = await createTestUser();
    const org = await createOrg(admin);
    const { body: invite } = await createInvite(admin, org.id);

    const response = await authenticatedFetch(
      managementUrl(`/invites/${invite.token}/accept`),
      { method: "POST" },
      invitee
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ org_id: org.id, role: "member" });
    const membership = await prisma.orgMembership.findFirst({
      where: { orgId: org.id, userId: invitee.id },
    });
    expect(membership).not.toBeNull();
  });

  it("rejects expired invites", async () => {
    const admin = await createTestUser();
    const invitee = await createTestUser();
    const org = await createOrg(admin);

    const invite = await prisma.invite.create({
      data: {
        orgId: org.id,
        token: "expired-token",
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const response = await authenticatedFetch(
      managementUrl(`/invites/${invite.token}/accept`),
      { method: "POST" },
      invitee
    );

    expect(response.status).toBe(410);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "invite_expired" });
  });

  it("rejects accepting invites for existing members", async () => {
    const admin = await createTestUser();
    const invitee = await createTestUser();
    const org = await createOrg(admin);
    const { body: invite } = await createInvite(admin, org.id);

    await prisma.orgMembership.create({
      data: { orgId: org.id, userId: invitee.id, role: "member" },
    });

    const response = await authenticatedFetch(
      managementUrl(`/invites/${invite.token}/accept`),
      { method: "POST" },
      invitee
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "conflict" });
  });
});
