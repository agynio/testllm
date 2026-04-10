import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthWithMembership } from "@/lib/auth-helpers";
import { parseRequestBody } from "@/lib/validation";
import { conflictError, notFoundError } from "@/lib/errors";
import {
  UpdateAnthropicTestSchema,
  UpdateTestSchema,
} from "@/lib/schemas/test-items";
import { findTestOrNull, formatTestResponse } from "@/lib/test-helpers";

type UpdateTestPayload =
  | z.infer<typeof UpdateTestSchema>
  | z.infer<typeof UpdateAnthropicTestSchema>;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; suiteId: string; testId: string }> }
) {
  const { orgId, suiteId, testId } = await params;

  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const test = await findTestOrNull(orgId, suiteId, testId);
  if (!test) return notFoundError("Test");

  const items = await prisma.testItem.findMany({
    where: { testId },
    orderBy: { position: "asc" },
  });

  return NextResponse.json(formatTestResponse(test, items));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; suiteId: string; testId: string }> }
) {
  const { orgId, suiteId, testId } = await params;

  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const test = await findTestOrNull(orgId, suiteId, testId);
  if (!test) return notFoundError("Test");

  const schema: z.ZodType<UpdateTestPayload> =
    test.testSuite.protocol === "anthropic"
      ? UpdateAnthropicTestSchema
      : UpdateTestSchema;
  const parsed = await parseRequestBody<UpdateTestPayload>(request, schema);
  if (!parsed.ok) return parsed.error;

  const { name, description, items } = parsed.data;

  if (name !== undefined && name !== test.name) {
    const nameConflict = await prisma.test.findUnique({
      where: { testSuiteId_name: { testSuiteId: suiteId, name } },
    });
    if (nameConflict) {
      return conflictError("A test with this name already exists in the suite");
    }
  }

  const metadataUpdate: Record<string, unknown> = {};
  if (name !== undefined) metadataUpdate.name = name;
  if (description !== undefined) metadataUpdate.description = description;

  if (items !== undefined) {
    const updatedTest = await prisma.$transaction(async (tx) => {
      await tx.testItem.deleteMany({ where: { testId } });

      return tx.test.update({
        where: { id: testId },
        data: {
          ...metadataUpdate,
          items: {
            create: items.map((item, index) => ({
              position: index,
              type: item.type,
              content: item.content as Prisma.InputJsonValue,
            })),
          },
        },
        include: {
          items: { orderBy: { position: "asc" } },
        },
      });
    });

    return NextResponse.json(formatTestResponse(updatedTest, updatedTest.items));
  }

  const updatedTest = await prisma.test.update({
    where: { id: testId },
    data: metadataUpdate,
    include: {
      items: { orderBy: { position: "asc" } },
    },
  });

  return NextResponse.json(formatTestResponse(updatedTest, updatedTest.items));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; suiteId: string; testId: string }> }
) {
  const { orgId, suiteId, testId } = await params;

  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const test = await findTestOrNull(orgId, suiteId, testId);
  if (!test) return notFoundError("Test");

  await prisma.test.delete({ where: { id: testId } });

  return new NextResponse(null, { status: 204 });
}
