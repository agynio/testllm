import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-helpers";
import { conflictError, errorResponse, notFoundError } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const authResult = await getAuthUser();
  if (!authResult.ok) return authResult.error;
  const { userId } = authResult.value;

  const invite = await prisma.invite.findUnique({
    where: { token },
  });

  if (!invite) {
    return notFoundError("Invite");
  }

  if (invite.expiresAt < new Date()) {
    return errorResponse(410, {
      message: "Invite has expired",
      type: "gone_error",
      code: "invite_expired",
    });
  }

  const existingMembership = await prisma.orgMembership.findUnique({
    where: {
      orgId_userId: {
        orgId: invite.orgId,
        userId,
      },
    },
  });
  if (existingMembership) {
    return conflictError("User is already a member of this organization");
  }

  await prisma.$transaction([
    prisma.orgMembership.create({
      data: {
        orgId: invite.orgId,
        userId,
        role: "member",
      },
    }),
    prisma.invite.delete({ where: { id: invite.id } }),
  ]);

  return NextResponse.json({
    org_id: invite.orgId,
    role: "member",
  });
}
