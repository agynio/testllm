import { describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { authenticatedFetch, createTestUser } from "../helpers/auth";
import { jsonRequest, managementUrl } from "../helpers/api";
import { prisma } from "../helpers/prisma";
import { createPersonalToken, tokenFetch } from "../helpers/tokens";
import { hashTokenRaw } from "@/lib/api-tokens";

describe("management api personal tokens", () => {
  it("creates personal tokens", async () => {
    const user = await createTestUser();
    const { response, body } = await createPersonalToken(user);

    expect(response.status).toBe(201);
    expect(body.name).toBe("Personal token");
    expect(body.token).toMatch(/^tlp_[0-9a-f]{32}$/);
    expect(body.token_prefix).toBe(body.token.slice(0, 8));
    expect(body.expires_at).toBeNull();
  });

  it("stores token hashes instead of raw values", async () => {
    const user = await createTestUser();
    const { body } = await createPersonalToken(user);

    const stored = await prisma.personalApiToken.findUnique({
      where: { id: body.id },
    });

    expect(stored).not.toBeNull();
    expect(stored?.tokenHash).toBe(hashTokenRaw(body.token));
    expect(stored?.tokenHash).not.toBe(body.token);
    expect(stored?.tokenPrefix).toBe(body.token_prefix);
  });

  it("supports token expiration on create", async () => {
    const user = await createTestUser();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { response, body } = await createPersonalToken(user, {
      payload: { name: "Expiring token", expires_at: expiresAt },
    });

    expect(response.status).toBe(201);
    expect(body.expires_at).toBe(expiresAt);
  });

  it("rejects expired token timestamps", async () => {
    const user = await createTestUser();
    const expiresAt = new Date(Date.now() - 1000).toISOString();

    const response = await authenticatedFetch(
      managementUrl("/user/tokens"),
      {
        method: "POST",
        ...jsonRequest({ name: "Too late", expires_at: expiresAt }),
      },
      user
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "invalid_request" });
  });

  it("validates create payloads", async () => {
    const user = await createTestUser();

    const response = await authenticatedFetch(
      managementUrl("/user/tokens"),
      {
        method: "POST",
        ...jsonRequest({ name: "" }),
      },
      user
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "invalid_request" });
  });

  it("rejects token creation without a session", async () => {
    const user = await createTestUser();
    const { body: token } = await createPersonalToken(user);

    const response = await tokenFetch(managementUrl("/user/tokens"), token.token, {
      method: "POST",
      ...jsonRequest({ name: "Blocked" }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "forbidden" });
  });

  it("lists personal tokens for the session user", async () => {
    const user = await createTestUser();
    await createPersonalToken(user, { payload: { name: "One" } });
    await createPersonalToken(user, { payload: { name: "Two" } });

    const response = await authenticatedFetch(managementUrl("/user/tokens"), {}, user);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(2);
  });

  it("orders tokens by newest first", async () => {
    const user = await createTestUser();
    const first = await createPersonalToken(user, { payload: { name: "First" } });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await createPersonalToken(user, { payload: { name: "Second" } });

    const response = await authenticatedFetch(managementUrl("/user/tokens"), {}, user);
    const body = await response.json();

    expect(body[0].id).toBe(second.body.id);
    expect(body[1].id).toBe(first.body.id);
  });

  it("returns null last_used_at before use", async () => {
    const user = await createTestUser();
    await createPersonalToken(user, { payload: { name: "Unused" } });

    const response = await authenticatedFetch(managementUrl("/user/tokens"), {}, user);
    const body = await response.json();

    expect(body[0].last_used_at).toBeNull();
  });

  it("does not include raw tokens in list responses", async () => {
    const user = await createTestUser();
    await createPersonalToken(user);

    const response = await authenticatedFetch(managementUrl("/user/tokens"), {}, user);
    const body = await response.json();

    expect(body[0].token).toBeUndefined();
  });

  it("isolates token lists by user", async () => {
    const user = await createTestUser();
    const other = await createTestUser();

    const { body: token } = await createPersonalToken(user);
    await createPersonalToken(other);

    const response = await authenticatedFetch(managementUrl("/user/tokens"), {}, user);
    const body = await response.json();

    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(token.id);
  });

  it("rejects listing without a session", async () => {
    const user = await createTestUser();
    const { body: token } = await createPersonalToken(user);

    const response = await tokenFetch(managementUrl("/user/tokens"), token.token);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "forbidden" });
  });

  it("returns an empty list when no tokens exist", async () => {
    const user = await createTestUser();

    const response = await authenticatedFetch(managementUrl("/user/tokens"), {}, user);
    const body = await response.json();

    expect(body).toEqual([]);
  });

  it("deletes tokens for the session user", async () => {
    const user = await createTestUser();
    const { body: token } = await createPersonalToken(user);

    const response = await authenticatedFetch(
      managementUrl(`/user/tokens/${token.id}`),
      { method: "DELETE" },
      user
    );

    expect(response.status).toBe(204);
    const remaining = await prisma.personalApiToken.findMany({
      where: { userId: user.id },
    });
    expect(remaining).toEqual([]);
  });

  it("returns 404 when deleting another user's token", async () => {
    const user = await createTestUser();
    const other = await createTestUser();
    const { body: token } = await createPersonalToken(user);

    const response = await authenticatedFetch(
      managementUrl(`/user/tokens/${token.id}`),
      { method: "DELETE" },
      other
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "not_found" });
  });

  it("returns 404 when deleting a missing token", async () => {
    const user = await createTestUser();
    const tokenId = randomUUID();

    const response = await authenticatedFetch(
      managementUrl(`/user/tokens/${tokenId}`),
      { method: "DELETE" },
      user
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "not_found" });
  });

  it("rejects token deletion without a session", async () => {
    const user = await createTestUser();
    const { body: token } = await createPersonalToken(user);

    const response = await tokenFetch(
      managementUrl(`/user/tokens/${token.id}`),
      token.token,
      { method: "DELETE" }
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toMatchObject({ code: "forbidden" });
  });
});
