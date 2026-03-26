import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthWithMembership } from "@/lib/auth-helpers";
import { notFoundError } from "@/lib/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; suiteId: string }> }
) {
  const { orgId, suiteId } = await params;

  const authResult = await getAuthWithMembership(orgId);
  if (!authResult.ok) return authResult.error;

  const suite = await prisma.testSuite.findUnique({
    where: { id: suiteId },
    include: {
      tests: {
        orderBy: { createdAt: "asc" },
        include: {
          items: { orderBy: { position: "asc" } },
        },
      },
    },
  });

  if (!suite || suite.orgId !== orgId) {
    return notFoundError("Test suite");
  }

  const exportData = {
    version: 1,
    name: suite.name,
    description: suite.description,
    tests: suite.tests.map((test) => ({
      name: test.name,
      description: test.description,
      items: test.items.map((item) => ({
        type: item.type,
        content: item.content,
      })),
    })),
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${suite.name}.json"`,
    },
  });
}
