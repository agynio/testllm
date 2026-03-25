import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-helpers";
import { parseRequestBody } from "@/lib/validation";
import { validationError } from "@/lib/errors";
import { generateToken } from "@/lib/api-tokens";
import { CreatePersonalTokenSchema } from "@/lib/schemas/api-tokens";

export async function POST(request: NextRequest) {
  const authResult = await requireSession();
  if (!authResult.ok) return authResult.error;
  const { userId } = authResult.value;

  const parsed = await parseRequestBody(request, CreatePersonalTokenSchema);
  if (!parsed.ok) return parsed.error;

  const expiresAt = parsed.data.expires_at
    ? new Date(parsed.data.expires_at)
    : null;
  if (expiresAt && expiresAt <= new Date()) {
    return validationError("expires_at must be in the future");
  }

  const token = generateToken("personal");
  const created = await prisma.personalApiToken.create({
    data: {
      userId,
      name: parsed.data.name,
      tokenHash: token.tokenHash,
      tokenPrefix: token.tokenPrefix,
      expiresAt: expiresAt ?? undefined,
    },
  });

  return NextResponse.json(
    {
      id: created.id,
      name: created.name,
      token: token.rawToken,
      token_prefix: created.tokenPrefix,
      expires_at: created.expiresAt?.toISOString() ?? null,
      created_at: created.createdAt.toISOString(),
    },
    { status: 201 }
  );
}

export async function GET() {
  const authResult = await requireSession();
  if (!authResult.ok) return authResult.error;
  const { userId } = authResult.value;

  const tokens = await prisma.personalApiToken.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    tokens.map((token) => ({
      id: token.id,
      name: token.name,
      token_prefix: token.tokenPrefix,
      expires_at: token.expiresAt?.toISOString() ?? null,
      last_used_at: token.lastUsedAt?.toISOString() ?? null,
      created_at: token.createdAt.toISOString(),
    }))
  );
}
