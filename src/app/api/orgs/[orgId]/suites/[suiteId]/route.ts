import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthWithMembership } from "@/lib/auth-helpers";
import { parseRequestBody } from "@/lib/validation";
import { conflictError, notFoundError } from "@/lib/errors";

const UpdateSuiteSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; suiteId: string }> }
) {
  const { orgId, suiteId } = await params;

  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const suite = await prisma.testSuite.findUnique({
    where: { id: suiteId },
  });
  if (!suite || suite.orgId !== orgId) {
    return notFoundError("Test suite");
  }

  return NextResponse.json({
    id: suite.id,
    org_id: suite.orgId,
    name: suite.name,
    description: suite.description,
    created_at: suite.createdAt.toISOString(),
    updated_at: suite.updatedAt.toISOString(),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; suiteId: string }> }
) {
  const { orgId, suiteId } = await params;

  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const parsed = await parseRequestBody(request, UpdateSuiteSchema);
  if (!parsed.ok) return parsed.error;

  const existing = await prisma.testSuite.findUnique({
    where: { id: suiteId },
  });
  if (!existing || existing.orgId !== orgId) {
    return notFoundError("Test suite");
  }

  if (parsed.data.name && parsed.data.name !== existing.name) {
    const nameConflict = await prisma.testSuite.findUnique({
      where: { orgId_name: { orgId, name: parsed.data.name } },
    });
    if (nameConflict) {
      return conflictError(
        "A test suite with this name already exists in the organization"
      );
    }
  }

  const suite = await prisma.testSuite.update({
    where: { id: suiteId },
    data: parsed.data,
  });

  return NextResponse.json({
    id: suite.id,
    org_id: suite.orgId,
    name: suite.name,
    description: suite.description,
    created_at: suite.createdAt.toISOString(),
    updated_at: suite.updatedAt.toISOString(),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; suiteId: string }> }
) {
  const { orgId, suiteId } = await params;

  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const existing = await prisma.testSuite.findUnique({
    where: { id: suiteId },
  });
  if (!existing || existing.orgId !== orgId) {
    return notFoundError("Test suite");
  }

  await prisma.testSuite.delete({ where: { id: suiteId } });

  return new NextResponse(null, { status: 204 });
}
