import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthWithMembership } from "@/lib/auth-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const memberships = await prisma.orgMembership.findMany({
    where: { orgId },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  const members = memberships.map((membership) => ({
    id: membership.id,
    user: {
      id: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
    },
    role: membership.role,
    created_at: membership.createdAt.toISOString(),
  }));

  return NextResponse.json(members);
}
