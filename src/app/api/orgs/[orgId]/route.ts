import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthWithMembership, requireRole } from "@/lib/auth-helpers";
import { parseBody } from "@/lib/validation";

const UpdateOrgSchema = z.object({
  name: z.string().min(1).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
  });

  return NextResponse.json({
    id: org.id,
    name: org.name,
    slug: org.slug,
    created_at: org.createdAt.toISOString(),
    updated_at: org.updatedAt.toISOString(),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const authResult = await requireRole(orgId, "admin");
  if (!authResult.ok) return authResult.error;

  const body = await request.json();
  const parsed = parseBody(UpdateOrgSchema, body);
  if (!parsed.ok) return parsed.error;

  const org = await prisma.organization.update({
    where: { id: orgId },
    data: parsed.data,
  });

  return NextResponse.json({
    id: org.id,
    name: org.name,
    slug: org.slug,
    created_at: org.createdAt.toISOString(),
    updated_at: org.updatedAt.toISOString(),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const authResult = await requireRole(orgId, "admin");
  if (!authResult.ok) return authResult.error;

  await prisma.organization.delete({ where: { id: orgId } });

  return new NextResponse(null, { status: 204 });
}
