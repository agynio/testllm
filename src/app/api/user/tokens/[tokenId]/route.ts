import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-helpers";
import { notFoundError } from "@/lib/errors";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId } = await params;

  const authResult = await requireSession();
  if (!authResult.ok) return authResult.error;
  const { userId } = authResult.value;

  const token = await prisma.personalApiToken.findUnique({
    where: { id: tokenId },
  });
  if (!token || token.userId !== userId) {
    return notFoundError("Token");
  }

  await prisma.personalApiToken.delete({ where: { id: tokenId } });

  return new NextResponse(null, { status: 204 });
}
