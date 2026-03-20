import { encode } from "@auth/core/jwt";
import { randomUUID } from "crypto";
import type { User } from "@prisma/client";
import { prisma } from "./prisma";

type CreateUserInput = Partial<Pick<User, "oidcSubject" | "email" | "name">>;

export async function createTestUser(overrides: CreateUserInput = {}) {
  return prisma.user.create({
    data: {
      oidcSubject: overrides.oidcSubject ?? `oidc-${randomUUID()}`,
      email: overrides.email ?? `user-${randomUUID()}@example.com`,
      name: overrides.name ?? "Test User",
    },
  });
}

export async function authCookie(user: User) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is required for auth cookies");
  }

  const token = await encode({
    token: {
      userId: user.id,
      oidcSubject: user.oidcSubject,
      email: user.email,
      name: user.name,
      sub: user.oidcSubject,
    },
    secret,
    salt: "authjs.session-token",
    maxAge: 30 * 24 * 60 * 60,
  });

  return `authjs.session-token=${token}`;
}

export async function authenticatedFetch(
  url: string,
  init: RequestInit = {},
  user?: User
) {
  const authUser = user ?? (await createTestUser());
  const cookie = await authCookie(authUser);

  const headers = new Headers(init.headers);
  headers.set("Cookie", cookie);

  return fetch(url, {
    ...init,
    headers,
  });
}
