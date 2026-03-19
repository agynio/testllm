import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { notFoundError } from "@/lib/errors";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; inviteId: string }> }
) {
  const { orgId, inviteId } = await params;

  const authResult = await requireRole(orgId, "admin");
  if (!authResult.ok) return authResult.error;

  const invite = await prisma.invite.findUnique({
    where: { id: inviteId },
  });
  if (!invite || invite.orgId !== orgId) {
    return notFoundError("Invite");
  }

  await prisma.invite.delete({ where: { id: inviteId } });

  return new NextResponse(null, { status: 204 });
}
