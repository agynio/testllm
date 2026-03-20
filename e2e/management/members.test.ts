import { describe, expect, it } from "vitest";
import { authenticatedFetch, createTestUser } from "../helpers/auth";
import { jsonRequest, managementUrl } from "../helpers/api";
import { createOrg } from "../helpers/management";
import { prisma } from "../helpers/prisma";

describe("management api members", () => {
  it("lists members for an organization", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });

    await prisma.orgMembership.create({
      data: { orgId: org.id, userId: member.id, role: "member" },
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/members`),
      {},
      admin
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(2);
    const roles = body.map((entry: { role: string }) => entry.role).sort();
    expect(roles).toEqual(["admin", "member"]);
  });

  it("allows members to list organization members", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });

    await prisma.orgMembership.create({
      data: { orgId: org.id, userId: member.id, role: "member" },
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/members`),
      {},
      member
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(2);
  });

  it("updates member roles as admin", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });

    const membership = await prisma.orgMembership.create({
      data: { orgId: org.id, userId: member.id, role: "member" },
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/members/${membership.id}`),
      {
        method: "PATCH",
        ...jsonRequest({ role: "admin" }),
      },
      admin
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.role).toBe("admin");
  });

  it("rejects member role updates from non-admins", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });

    const membership = await prisma.orgMembership.create({
      data: { orgId: org.id, userId: member.id, role: "member" },
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/members/${membership.id}`),
      {
        method: "PATCH",
        ...jsonRequest({ role: "admin" }),
      },
      member
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "forbidden" });
  });

  it("returns 404 when updating members outside the org", async () => {
    const admin = await createTestUser();
    const otherAdmin = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });
    const { body: otherOrg } = await createOrg(otherAdmin, {
      uniqueSlug: true,
    });

    const membership = await prisma.orgMembership.findFirstOrThrow({
      where: { orgId: otherOrg.id, userId: otherAdmin.id },
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/members/${membership.id}`),
      {
        method: "PATCH",
        ...jsonRequest({ role: "member" }),
      },
      admin
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "not_found" });
  });

  it("removes members as admin", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });

    const membership = await prisma.orgMembership.create({
      data: { orgId: org.id, userId: member.id, role: "member" },
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/members/${membership.id}`),
      { method: "DELETE" },
      admin
    );

    expect(response.status).toBe(204);
    const remaining = await prisma.orgMembership.findMany({
      where: { orgId: org.id, userId: member.id },
    });
    expect(remaining).toEqual([]);
  });

  it("rejects member deletion from non-admins", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });

    const membership = await prisma.orgMembership.create({
      data: { orgId: org.id, userId: member.id, role: "member" },
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/members/${membership.id}`),
      { method: "DELETE" },
      member
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "forbidden" });
  });

  it("returns 404 when deleting members outside the org", async () => {
    const admin = await createTestUser();
    const otherAdmin = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });
    const { body: otherOrg } = await createOrg(otherAdmin, {
      uniqueSlug: true,
    });

    const membership = await prisma.orgMembership.findFirstOrThrow({
      where: { orgId: otherOrg.id, userId: otherAdmin.id },
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/members/${membership.id}`),
      { method: "DELETE" },
      admin
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "not_found" });
  });

  it("prevents removing the last admin", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });

    const membership = await prisma.orgMembership.findFirstOrThrow({
      where: { orgId: org.id, userId: admin.id },
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/members/${membership.id}`),
      { method: "DELETE" },
      admin
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "last_admin" });
  });

  it("allows removing admins when another admin exists", async () => {
    const admin = await createTestUser();
    const secondAdmin = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });

    const secondMembership = await prisma.orgMembership.create({
      data: { orgId: org.id, userId: secondAdmin.id, role: "admin" },
    });

    const response = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/members/${secondMembership.id}`),
      { method: "DELETE" },
      admin
    );

    expect(response.status).toBe(204);
    const remainingAdmins = await prisma.orgMembership.count({
      where: { orgId: org.id, role: "admin" },
    });
    expect(remainingAdmins).toBe(1);
  });
});
