import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionAdmin } from "@/lib/auth-helpers";
import { notFoundError } from "@/lib/errors";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; tokenId: string }> }
) {
  const { orgId, tokenId } = await params;

  const authResult = await requireSessionAdmin(orgId);
  if (!authResult.ok) return authResult.error;

  const token = await prisma.orgApiToken.findUnique({
    where: { id: tokenId },
  });
  if (!token || token.orgId !== orgId) {
    return notFoundError("Token");
  }

  await prisma.orgApiToken.delete({ where: { id: tokenId } });

  return new NextResponse(null, { status: 204 });
}
