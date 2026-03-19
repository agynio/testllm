import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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

export async function getAuthUser(): Promise<AuthResult<AuthUser>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: unauthorizedError() };
  }
  return { ok: true, value: { userId: session.user.id } };
}

export async function getAuthWithMembership(
  orgId: string
): Promise<AuthResult<AuthWithMembership>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: unauthorizedError() };
  }

  const membership = await prisma.orgMembership.findUnique({
    where: {
      orgId_userId: {
        orgId,
        userId: session.user.id,
      },
    },
  });

  if (!membership) {
    return { ok: false, error: notFoundError("Organization") };
  }

  return {
    ok: true,
    value: {
      userId: session.user.id,
      membership: {
        id: membership.id,
        role: membership.role,
        orgId: membership.orgId,
        userId: membership.userId,
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
