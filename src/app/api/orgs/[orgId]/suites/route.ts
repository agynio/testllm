import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthWithMembership } from "@/lib/auth-helpers";
import { parseRequestBody } from "@/lib/validation";
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

  const parsed = await parseRequestBody(request, CreateSuiteSchema);
  if (!parsed.ok) return parsed.error;
  const { name, description } = parsed.data;

  try {
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
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return conflictError(
        "A test suite with this name already exists in the organization"
      );
    }
    throw error;
  }
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
