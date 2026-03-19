import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { parseRequestBody } from "@/lib/validation";
import { errorResponse, notFoundError } from "@/lib/errors";

const UpdateMemberSchema = z.object({
  role: z.enum(["admin", "member"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; membershipId: string }> }
) {
  const { orgId, membershipId } = await params;

  const authResult = await requireRole(orgId, "admin");
  if (!authResult.ok) return authResult.error;

  const parsed = await parseRequestBody(request, UpdateMemberSchema);
  if (!parsed.ok) return parsed.error;

  const existing = await prisma.orgMembership.findUnique({
    where: { id: membershipId },
  });
  if (!existing || existing.orgId !== orgId) {
    return notFoundError("Membership");
  }

  const updated = await prisma.orgMembership.update({
    where: { id: membershipId },
    data: { role: parsed.data.role },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });

  return NextResponse.json({
    id: updated.id,
    user: {
      id: updated.user.id,
      email: updated.user.email,
      name: updated.user.name,
    },
    role: updated.role,
    created_at: updated.createdAt.toISOString(),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; membershipId: string }> }
) {
  const { orgId, membershipId } = await params;

  const authResult = await requireRole(orgId, "admin");
  if (!authResult.ok) return authResult.error;

  const existing = await prisma.orgMembership.findUnique({
    where: { id: membershipId },
  });
  if (!existing || existing.orgId !== orgId) {
    return notFoundError("Membership");
  }

  if (existing.role === "admin") {
    const adminCount = await prisma.orgMembership.count({
      where: { orgId, role: "admin" },
    });
    if (adminCount <= 1) {
      return errorResponse(400, {
        message: "Cannot remove the last admin of the organization",
        type: "validation_error",
        code: "last_admin",
      });
    }
  }

  await prisma.orgMembership.delete({ where: { id: membershipId } });

  return new NextResponse(null, { status: 204 });
}
