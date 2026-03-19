import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-helpers";
import { parseRequestBody } from "@/lib/validation";
import { conflictError } from "@/lib/errors";

const CreateOrgSchema = z.object({
  name: z.string().min(1, { error: "name is required" }),
  slug: z
    .string()
    .min(1, { error: "slug is required" })
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      error: "slug must be lowercase alphanumeric with hyphens",
    }),
});

export async function POST(request: NextRequest) {
  const authResult = await getAuthUser();
  if (!authResult.ok) return authResult.error;
  const { userId } = authResult.value;

  const parsed = await parseRequestBody(request, CreateOrgSchema);
  if (!parsed.ok) return parsed.error;
  const { name, slug } = parsed.data;

  try {
    const org = await prisma.organization.create({
      data: {
        name,
        slug,
        memberships: {
          create: {
            userId,
            role: "admin",
          },
        },
      },
    });

    return NextResponse.json(
      {
        id: org.id,
        name: org.name,
        slug: org.slug,
        created_at: org.createdAt.toISOString(),
        updated_at: org.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return conflictError("An organization with this slug already exists");
    }
    throw error;
  }
}

export async function GET() {
  const authResult = await getAuthUser();
  if (!authResult.ok) return authResult.error;
  const { userId } = authResult.value;

  const memberships = await prisma.orgMembership.findMany({
    where: { userId },
    include: { org: true },
  });

  const orgs = memberships.map((membership) => ({
    id: membership.org.id,
    name: membership.org.name,
    slug: membership.org.slug,
    role: membership.role,
    created_at: membership.org.createdAt.toISOString(),
    updated_at: membership.org.updatedAt.toISOString(),
  }));

  return NextResponse.json(orgs);
}
