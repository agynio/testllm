import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthWithMembership } from "@/lib/auth-helpers";
import { parseRequestBody } from "@/lib/validation";
import { conflictError, notFoundError } from "@/lib/errors";
import {
  CreateAnthropicTestSchema,
  CreateTestSchema,
} from "@/lib/schemas/test-items";
import { findSuiteOrNull, formatTestResponse } from "@/lib/test-helpers";

type CreateTestPayload =
  | z.infer<typeof CreateTestSchema>
  | z.infer<typeof CreateAnthropicTestSchema>;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; suiteId: string }> }
) {
  const { orgId, suiteId } = await params;

  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const suite = await findSuiteOrNull(orgId, suiteId);
  if (!suite) return notFoundError("Test suite");

  const schema: z.ZodType<CreateTestPayload> =
    suite.protocol === "anthropic"
      ? CreateAnthropicTestSchema
      : CreateTestSchema;
  const parsed = await parseRequestBody<CreateTestPayload>(request, schema);
  if (!parsed.ok) return parsed.error;
  const { name, description, items } = parsed.data;

  try {
    const test = await prisma.test.create({
      data: {
        testSuiteId: suiteId,
        name,
        description,
        items: {
          create: items.map((item, index) => ({
            position: index,
            type: item.type,
            content: item.content as Prisma.InputJsonValue,
          })),
        },
      },
      include: {
        items: {
          orderBy: { position: "asc" },
        },
      },
    });

    return NextResponse.json(formatTestResponse(test, test.items), {
      status: 201,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return conflictError("A test with this name already exists in the suite");
    }
    throw error;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; suiteId: string }> }
) {
  const { orgId, suiteId } = await params;

  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const suite = await findSuiteOrNull(orgId, suiteId);
  if (!suite) return notFoundError("Test suite");

  const tests = await prisma.test.findMany({
    where: { testSuiteId: suiteId },
  });

  return NextResponse.json(tests.map((test) => formatTestResponse(test)));
}
