import type { TestItemType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type TestSummary = {
  id: string;
  testSuiteId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type TestItemSummary = {
  id: string;
  position: number;
  type: TestItemType;
  content: unknown;
};

export type TestResponseItem = {
  id: string;
  position: number;
  type: TestItemType;
  content: unknown;
};

export type TestResponseBody = {
  id: string;
  test_suite_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  items?: TestResponseItem[];
};

export async function findSuiteOrNull(orgId: string, suiteId: string) {
  const suite = await prisma.testSuite.findUnique({
    where: { id: suiteId },
  });
  if (!suite || suite.orgId !== orgId) return null;
  return suite;
}

export async function findTestOrNull(
  orgId: string,
  suiteId: string,
  testId: string
) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: { testSuite: { include: { org: true } } },
  });
  if (!test) return null;
  if (test.testSuiteId !== suiteId) return null;
  if (test.testSuite.orgId !== orgId) return null;
  return test;
}

export function formatTestResponse(
  test: TestSummary,
  items?: TestItemSummary[]
): TestResponseBody {
  const response: TestResponseBody = {
    id: test.id,
    test_suite_id: test.testSuiteId,
    name: test.name,
    description: test.description,
    created_at: test.createdAt.toISOString(),
    updated_at: test.updatedAt.toISOString(),
  };

  if (items) {
    response.items = items.map((item) => ({
      id: item.id,
      position: item.position,
      type: item.type,
      content: item.content,
    }));
  }

  return response;
}
