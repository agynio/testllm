import { headers } from "next/headers";
import { OrgRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface PersonalTokenIdentity {
  kind: "personal_token";
  tokenId: string;
  userId: string;
}

export interface OrgTokenIdentity {
  kind: "org_token";
  tokenId: string;
  orgId: string;
  role: OrgRole;
}

export type TokenIdentity = PersonalTokenIdentity | OrgTokenIdentity;

export async function resolveTokenIdentity(): Promise<TokenIdentity | null> {
  const headerList = await headers();
  const tokenHash = headerList.get("x-token-hash");
  const tokenType = headerList.get("x-token-type");

  if (!tokenHash || !tokenType) return null;

  if (tokenType === "personal") {
    const row = await prisma.personalApiToken.findUnique({
      where: { tokenHash },
    });
    if (!row) return null;
    if (row.expiresAt && row.expiresAt < new Date()) return null;

    void prisma.personalApiToken
      .update({
        where: { id: row.id },
        data: { lastUsedAt: new Date() },
      })
      .then(() => undefined);

    return { kind: "personal_token", tokenId: row.id, userId: row.userId };
  }

  if (tokenType === "org") {
    const row = await prisma.orgApiToken.findUnique({
      where: { tokenHash },
    });
    if (!row) return null;
    if (row.expiresAt && row.expiresAt < new Date()) return null;

    void prisma.orgApiToken
      .update({
        where: { id: row.id },
        data: { lastUsedAt: new Date() },
      })
      .then(() => undefined);

    return {
      kind: "org_token",
      tokenId: row.id,
      orgId: row.orgId,
      role: row.role,
    };
  }

  return null;
}
