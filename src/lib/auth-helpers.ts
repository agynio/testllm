import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveTokenIdentity } from "@/lib/token-auth";
import { unauthorizedError, forbiddenError, notFoundError } from "@/lib/errors";
import { NextResponse } from "next/server";
import { OrgRole } from "@prisma/client";

interface AuthUser {
  userId: string;
}

interface AuthWithMembership {
  userId: string;
  membership: {
    id: string;
    role: OrgRole;
    orgId: string;
    userId: string;
  };
}

type AuthResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: NextResponse };

async function resolveUserMembership(userId: string, orgId: string) {
  const membership = await prisma.orgMembership.findUnique({
    where: {
      orgId_userId: {
        orgId,
        userId,
      },
    },
  });

  if (!membership) return null;

  return {
    id: membership.id,
    role: membership.role,
    orgId: membership.orgId,
    userId: membership.userId,
  };
}

export async function getAuthUser(): Promise<AuthResult<AuthUser>> {
  const session = await auth();
  if (session?.user?.id) {
    return { ok: true, value: { userId: session.user.id } };
  }

  const token = await resolveTokenIdentity();
  if (!token) {
    return { ok: false, error: unauthorizedError() };
  }

  if (token.kind !== "personal_token") {
    return { ok: false, error: unauthorizedError() };
  }

  return { ok: true, value: { userId: token.userId } };
}

export async function getAuthWithMembership(
  orgId: string
): Promise<AuthResult<AuthWithMembership>> {
  const session = await auth();
  if (session?.user?.id) {
    const membership = await resolveUserMembership(session.user.id, orgId);
    if (!membership) {
      return { ok: false, error: notFoundError("Organization") };
    }

    return {
      ok: true,
      value: {
        userId: session.user.id,
        membership,
      },
    };
  }

  const token = await resolveTokenIdentity();
  if (!token) {
    return { ok: false, error: unauthorizedError() };
  }

  if (token.kind === "personal_token") {
    const membership = await resolveUserMembership(token.userId, orgId);
    if (!membership) {
      return { ok: false, error: notFoundError("Organization") };
    }

    return {
      ok: true,
      value: {
        userId: token.userId,
        membership,
      },
    };
  }

  if (token.orgId !== orgId) {
    return { ok: false, error: notFoundError("Organization") };
  }

  return {
    ok: true,
    value: {
      userId: token.tokenId,
      membership: {
        id: token.tokenId,
        role: token.role,
        orgId: token.orgId,
        userId: token.tokenId,
      },
    },
  };
}

export async function requireRole(
  orgId: string,
  requiredRole: "admin"
): Promise<AuthResult<AuthWithMembership>> {
  const result = await getAuthWithMembership(orgId);
  if (!result.ok) return result;

  if (result.value.membership.role !== requiredRole) {
    return { ok: false, error: forbiddenError() };
  }

  return result;
}

export async function requireSession(): Promise<AuthResult<AuthUser>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: forbiddenError() };
  }

  return { ok: true, value: { userId: session.user.id } };
}

export async function requireSessionAdmin(
  orgId: string
): Promise<AuthResult<AuthWithMembership>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: forbiddenError() };
  }

  const membership = await resolveUserMembership(session.user.id, orgId);
  if (!membership) {
    return { ok: false, error: notFoundError("Organization") };
  }

  if (membership.role !== "admin") {
    return { ok: false, error: forbiddenError() };
  }

  return {
    ok: true,
    value: {
      userId: session.user.id,
      membership,
    },
  };
}
