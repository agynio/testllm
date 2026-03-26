"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getFormValue, requireAdmin } from "@/actions/helpers";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/api-tokens";

export type TokenCreateResult =
  | { success: true; rawToken: string }
  | { success: false; error: string };

function computeExpiresAt(expiresIn: string): Date | null {
  const now = Date.now();

  switch (expiresIn) {
    case "24h":
      return new Date(now + 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(now + 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now + 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now + 90 * 24 * 60 * 60 * 1000);
    case "never":
      return null;
    default:
      throw new Error(`Unknown expiresIn value: ${expiresIn}`);
  }
}

export async function createPersonalToken(
  _prevState: TokenCreateResult | null,
  formData: FormData
): Promise<TokenCreateResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const name = getFormValue(formData, "name")?.trim();
  if (!name) {
    return { success: false, error: "Name is required" };
  }

  const expiresIn = getFormValue(formData, "expiresIn");
  if (!expiresIn) {
    return { success: false, error: "Expiration is required" };
  }
  const expiresAt = computeExpiresAt(expiresIn);

  const token = generateToken("personal");

  await prisma.personalApiToken.create({
    data: {
      userId: session.user.id,
      name,
      tokenHash: token.tokenHash,
      tokenPrefix: token.tokenPrefix,
      expiresAt,
    },
  });

  return { success: true, rawToken: token.rawToken };
}

export async function deletePersonalToken(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const tokenId = getFormValue(formData, "tokenId");
  if (!tokenId) {
    throw new Error("Token not found");
  }

  const token = await prisma.personalApiToken.findUnique({
    where: { id: tokenId },
  });

  if (!token || token.userId !== session.user.id) {
    throw new Error("Token not found");
  }

  await prisma.personalApiToken.delete({ where: { id: tokenId } });
  revalidatePath("/settings/tokens");
}

export async function createOrgToken(
  _prevState: TokenCreateResult | null,
  formData: FormData
): Promise<TokenCreateResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const orgId = getFormValue(formData, "orgId");
  if (!orgId) {
    return { success: false, error: "Organization not found" };
  }

  const membership = await requireAdmin(orgId, session.user.id);
  if (!membership) {
    return { success: false, error: "You do not have access to create tokens" };
  }

  const name = getFormValue(formData, "name")?.trim();
  if (!name) {
    return { success: false, error: "Name is required" };
  }

  const role = getFormValue(formData, "role");
  if (role !== "admin" && role !== "member") {
    return { success: false, error: "Invalid role" };
  }

  const expiresIn = getFormValue(formData, "expiresIn");
  if (!expiresIn) {
    return { success: false, error: "Expiration is required" };
  }
  const expiresAt = computeExpiresAt(expiresIn);

  const token = generateToken("org");

  await prisma.orgApiToken.create({
    data: {
      orgId,
      name,
      role,
      tokenHash: token.tokenHash,
      tokenPrefix: token.tokenPrefix,
      expiresAt,
    },
  });

  return { success: true, rawToken: token.rawToken };
}

export async function deleteOrgToken(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const orgId = getFormValue(formData, "orgId");
  const tokenId = getFormValue(formData, "tokenId");

  if (!orgId || !tokenId) {
    throw new Error("Token not found");
  }

  const membership = await requireAdmin(orgId, session.user.id);
  if (!membership) {
    throw new Error("You do not have access to delete tokens");
  }

  const token = await prisma.orgApiToken.findUnique({
    where: { id: tokenId },
  });

  if (!token || token.orgId !== orgId) {
    throw new Error("Token not found");
  }

  await prisma.orgApiToken.delete({ where: { id: tokenId } });
  revalidatePath(`/orgs/${orgId}/tokens`);
}
