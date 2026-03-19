import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthWithMembership } from "@/lib/auth-helpers";
import { parseBody } from "@/lib/validation";
import { conflictError, notFoundError } from "@/lib/errors";
import { CreateTestSchema } from "@/lib/schemas/test-items";
import { findSuiteOrNull, formatTestResponse } from "@/lib/test-helpers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; suiteId: string }> }
) {
  const { orgId, suiteId } = await params;

  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const suite = await findSuiteOrNull(orgId, suiteId);
  if (!suite) return notFoundError("Test suite");

  const body = await request.json();
  const parsed = parseBody(CreateTestSchema, body);
  if (!parsed.ok) return parsed.error;
  const { name, description, items } = parsed.data;

  const existing = await prisma.test.findUnique({
    where: { testSuiteId_name: { testSuiteId: suiteId, name } },
  });
  if (existing) {
    return conflictError("A test with this name already exists in the suite");
  }

  const test = await prisma.test.create({
    data: {
      testSuiteId: suiteId,
      name,
      description,
      items: {
        create: items.map((item, index) => ({
          position: index,
          type: item.type,
          content: item.content,
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
