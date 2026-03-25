import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionAdmin } from "@/lib/auth-helpers";
import { parseRequestBody } from "@/lib/validation";
import { validationError } from "@/lib/errors";
import { generateToken } from "@/lib/api-tokens";
import { CreateOrgTokenSchema } from "@/lib/schemas/api-tokens";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const authResult = await requireSessionAdmin(orgId);
  if (!authResult.ok) return authResult.error;

  const parsed = await parseRequestBody(request, CreateOrgTokenSchema);
  if (!parsed.ok) return parsed.error;

  const expiresAt = parsed.data.expires_at
    ? new Date(parsed.data.expires_at)
    : null;
  if (expiresAt && expiresAt <= new Date()) {
    return validationError("expires_at must be in the future");
  }

  const token = generateToken("org");
  const created = await prisma.orgApiToken.create({
    data: {
      orgId,
      name: parsed.data.name,
      role: parsed.data.role,
      tokenHash: token.tokenHash,
      tokenPrefix: token.tokenPrefix,
      expiresAt: expiresAt ?? undefined,
    },
  });

  return NextResponse.json(
    {
      id: created.id,
      name: created.name,
      role: created.role,
      token: token.rawToken,
      token_prefix: created.tokenPrefix,
      expires_at: created.expiresAt?.toISOString() ?? null,
      created_at: created.createdAt.toISOString(),
    },
    { status: 201 }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const authResult = await requireSessionAdmin(orgId);
  if (!authResult.ok) return authResult.error;

  const tokens = await prisma.orgApiToken.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    tokens.map((token) => ({
      id: token.id,
      name: token.name,
      role: token.role,
      token_prefix: token.tokenPrefix,
      expires_at: token.expiresAt?.toISOString() ?? null,
      last_used_at: token.lastUsedAt?.toISOString() ?? null,
      created_at: token.createdAt.toISOString(),
    }))
  );
}
