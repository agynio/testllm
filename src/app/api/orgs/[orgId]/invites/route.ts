import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const authResult = await requireRole(orgId, "admin");
  if (!authResult.ok) return authResult.error;

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const invite = await prisma.invite.create({
    data: {
      orgId,
      token,
      expiresAt,
    },
  });

  const baseUrl = process.env.AUTH_URL ?? request.nextUrl.origin;
  const url = `${baseUrl}/invite/${invite.token}`;

  return NextResponse.json(
    {
      id: invite.id,
      token: invite.token,
      url,
      expires_at: invite.expiresAt.toISOString(),
      created_at: invite.createdAt.toISOString(),
    },
    { status: 201 }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const authResult = await requireRole(orgId, "admin");
  if (!authResult.ok) return authResult.error;

  const invites = await prisma.invite.findMany({
    where: { orgId },
  });

  const baseUrl = process.env.AUTH_URL ?? request.nextUrl.origin;

  return NextResponse.json(
    invites.map((invite) => ({
      id: invite.id,
      token: invite.token,
      url: `${baseUrl}/invite/${invite.token}`,
      expires_at: invite.expiresAt.toISOString(),
      created_at: invite.createdAt.toISOString(),
    }))
  );
}
