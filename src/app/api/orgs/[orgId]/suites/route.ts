import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthWithMembership } from "@/lib/auth-helpers";
import { parseBody } from "@/lib/validation";
import { conflictError } from "@/lib/errors";

const CreateSuiteSchema = z.object({
  name: z.string().min(1, { error: "name is required" }),
  description: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const body = await request.json();
  const parsed = parseBody(CreateSuiteSchema, body);
  if (!parsed.ok) return parsed.error;
  const { name, description } = parsed.data;

  const existing = await prisma.testSuite.findUnique({
    where: { orgId_name: { orgId, name } },
  });
  if (existing) {
    return conflictError(
      "A test suite with this name already exists in the organization"
    );
  }

  const suite = await prisma.testSuite.create({
    data: { orgId, name, description },
  });

  return NextResponse.json(
    {
      id: suite.id,
      org_id: suite.orgId,
      name: suite.name,
      description: suite.description,
      created_at: suite.createdAt.toISOString(),
      updated_at: suite.updatedAt.toISOString(),
    },
    { status: 201 }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const suites = await prisma.testSuite.findMany({
    where: { orgId },
  });

  return NextResponse.json(
    suites.map((suite) => ({
      id: suite.id,
      org_id: suite.orgId,
      name: suite.name,
      description: suite.description,
      created_at: suite.createdAt.toISOString(),
      updated_at: suite.updatedAt.toISOString(),
    }))
  );
}
