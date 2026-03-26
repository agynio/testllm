import { describe, expect, it } from "vitest";
import { authenticatedFetch, createTestUser } from "../helpers/auth";
import { jsonRequest, managementUrl, responsesUrl } from "../helpers/api";
import { createOrg } from "../helpers/management";
import { prisma } from "../helpers/prisma";
import { createOrgToken, createPersonalToken, tokenFetch } from "../helpers/tokens";
import { generateToken } from "@/lib/api-tokens";
import { simpleMessageSequence, withPositions } from "../helpers/fixtures";

describe("token authentication", () => {
  it("allows personal tokens to list orgs and fetch org details", async () => {
    const user = await createTestUser();
    const { body: org } = await createOrg(user, { uniqueSlug: true });
    const { body: token } = await createPersonalToken(user);

    const listResponse = await tokenFetch(managementUrl("/orgs"), token.token);
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody).toHaveLength(1);
    expect(listBody[0].id).toBe(org.id);

    const orgResponse = await tokenFetch(
      managementUrl(`/orgs/${org.id}`),
      token.token
    );
    expect(orgResponse.status).toBe(200);
    const orgBody = await orgResponse.json();
    expect(orgBody.id).toBe(org.id);
  });

  it("allows personal tokens to create suites", async () => {
    const user = await createTestUser();
    const { body: org } = await createOrg(user, { uniqueSlug: true });
    const { body: token } = await createPersonalToken(user);

    const response = await tokenFetch(
      managementUrl(`/orgs/${org.id}/suites`),
      token.token,
      {
        method: "POST",
        ...jsonRequest({ name: "suite-alpha", description: "Alpha" }),
      }
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.name).toBe("suite-alpha");
  });

  it("returns 404 for personal tokens outside the org", async () => {
    const admin = await createTestUser();
    const outsider = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });
    const { body: token } = await createPersonalToken(outsider);

    const response = await tokenFetch(
      managementUrl(`/orgs/${org.id}`),
      token.token
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "not_found" });
  });

  it("enforces admin role for personal tokens", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });

    await prisma.orgMembership.create({
      data: { orgId: org.id, userId: member.id, role: "member" },
    });

    const { body: token } = await createPersonalToken(member);

    const response = await tokenFetch(
      managementUrl(`/orgs/${org.id}`),
      token.token,
      {
        method: "PATCH",
        ...jsonRequest({ name: "Blocked" }),
      }
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "forbidden" });
  });

  it("rejects expired personal tokens", async () => {
    const user = await createTestUser();
    const token = generateToken("personal");

    await prisma.personalApiToken.create({
      data: {
        userId: user.id,
        name: "Expired",
        tokenHash: token.tokenHash,
        tokenPrefix: token.tokenPrefix,
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const response = await tokenFetch(managementUrl("/orgs"), token.rawToken);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "unauthorized" });
  });

  it("rejects deleted personal tokens", async () => {
    const user = await createTestUser();
    await createOrg(user, { uniqueSlug: true });
    const { body: token } = await createPersonalToken(user);

    await prisma.personalApiToken.delete({ where: { id: token.id } });

    const response = await tokenFetch(managementUrl("/orgs"), token.token);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "unauthorized" });
  });

  it("updates last_used_at for personal tokens", async () => {
    const user = await createTestUser();
    const { body: org } = await createOrg(user, { uniqueSlug: true });
    const { body: token } = await createPersonalToken(user);

    const response = await tokenFetch(
      managementUrl(`/orgs/${org.id}`),
      token.token
    );

    expect(response.status).toBe(200);
    let updated = await prisma.personalApiToken.findUnique({
      where: { id: token.id },
    });
    const deadline = Date.now() + 500;
    while (!updated?.lastUsedAt && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      updated = await prisma.personalApiToken.findUnique({
        where: { id: token.id },
      });
    }
    expect(updated?.lastUsedAt).not.toBeNull();
  });

  it("allows org tokens to access their org", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });
    const { body: token } = await createOrgToken(admin, org.id, {
      payload: { role: "member" },
    });

    const response = await tokenFetch(
      managementUrl(`/orgs/${org.id}`),
      token.token
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe(org.id);
  });

  it("returns 404 for org tokens hitting a different org", async () => {
    const admin = await createTestUser();
    const otherAdmin = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });
    const { body: otherOrg } = await createOrg(otherAdmin, { uniqueSlug: true });
    const { body: token } = await createOrgToken(admin, org.id);

    const response = await tokenFetch(
      managementUrl(`/orgs/${otherOrg.id}`),
      token.token
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "not_found" });
  });

  it("allows org tokens to list their org", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });
    const { body: token } = await createOrgToken(admin, org.id);

    const response = await tokenFetch(managementUrl("/orgs"), token.token);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(org.id);
  });

  it("rejects invite acceptance with org tokens", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });
    const { body: token } = await createOrgToken(admin, org.id);

    const inviteResponse = await authenticatedFetch(
      managementUrl(`/orgs/${org.id}/invites`),
      { method: "POST" },
      admin
    );
    const inviteBody = await inviteResponse.json();

    const response = await tokenFetch(
      managementUrl(`/invites/${inviteBody.token}/accept`),
      token.token,
      { method: "POST" }
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "unauthorized" });
  });

  it("allows admin org tokens to perform admin operations", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });
    const { body: token } = await createOrgToken(admin, org.id, {
      payload: { role: "admin" },
    });

    const response = await tokenFetch(
      managementUrl(`/orgs/${org.id}`),
      token.token,
      {
        method: "PATCH",
        ...jsonRequest({ name: "Renamed" }),
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.name).toBe("Renamed");
  });

  it("enforces member roles for org tokens", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });
    const { body: token } = await createOrgToken(admin, org.id, {
      payload: { role: "member" },
    });

    const response = await tokenFetch(
      managementUrl(`/orgs/${org.id}`),
      token.token,
      {
        method: "PATCH",
        ...jsonRequest({ name: "Blocked" }),
      }
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "forbidden" });
  });

  it("allows org token members to create suites", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });
    const { body: token } = await createOrgToken(admin, org.id, {
      payload: { role: "member" },
    });

    const response = await tokenFetch(
      managementUrl(`/orgs/${org.id}/suites`),
      token.token,
      {
        method: "POST",
        ...jsonRequest({ name: "suite-beta", description: "Beta" }),
      }
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.name).toBe("suite-beta");
  });

  it("rejects expired org tokens", async () => {
    const admin = await createTestUser();
    const { body: org } = await createOrg(admin, { uniqueSlug: true });
    const token = generateToken("org");

    await prisma.orgApiToken.create({
      data: {
        orgId: org.id,
        name: "Expired",
        role: "admin",
        tokenHash: token.tokenHash,
        tokenPrefix: token.tokenPrefix,
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const response = await tokenFetch(
      managementUrl(`/orgs/${org.id}`),
      token.rawToken
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "unauthorized" });
  });

  it("rejects unknown prefixes and spoofed token headers", async () => {
    const unknownResponse = await fetch(managementUrl("/orgs"), {
      headers: { Authorization: "Bearer tlx_invalid" },
    });

    expect(unknownResponse.status).toBe(401);
    const unknownBody = await unknownResponse.json();
    expect(unknownBody.error).toMatchObject({ code: "unauthorized" });

    const spoofedResponse = await fetch(managementUrl("/orgs"), {
      headers: {
        "x-token-hash": "deadbeef",
        "x-token-type": "personal",
      },
    });

    expect(spoofedResponse.status).toBe(401);
    const spoofedBody = await spoofedResponse.json();
    expect(spoofedBody.error).toMatchObject({ code: "unauthorized" });
  });

  it("rejects nonexistent tokens", async () => {
    const rawToken = `tlp_${"0".repeat(32)}`;

    const response = await tokenFetch(managementUrl("/orgs"), rawToken);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "unauthorized" });
  });

  it("allows Responses API calls with bearer tokens", async () => {
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

    const response = await tokenFetch(
      responsesUrl(org.slug, suite.name),
      `tlp_${"1".repeat(32)}`,
      {
        method: "POST",
        ...jsonRequest({
          model: test.name,
          input: [{ role: "user", content: "Hello there" }],
        }),
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("completed");
  });
});
