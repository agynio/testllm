"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getFormValue, requireMembership } from "@/actions/helpers";
import type { ActionResult } from "@/actions/types";
import { prisma } from "@/lib/prisma";
import { findSuiteOrNull, findTestOrNull } from "@/lib/test-helpers";
import { CreateTestSchema, UpdateTestSchema } from "@/lib/schemas/test-items";

function parseItems(raw: string | undefined) {
  if (!raw) {
    return { ok: false, error: "Items are required" } as const;
  }
  try {
    return { ok: true, value: JSON.parse(raw) } as const;
  } catch {
    return { ok: false, error: "Items must be valid JSON" } as const;
  }
}

export async function createTest(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const orgId = getFormValue(formData, "orgId");
  const suiteId = getFormValue(formData, "suiteId");

  if (!orgId || !suiteId) {
    return { success: false, error: "Test suite not found" };
  }

  const membership = await requireMembership(orgId, session.user.id);
  if (!membership) {
    return { success: false, error: "Organization not found" };
  }

  const suite = await findSuiteOrNull(orgId, suiteId);
  if (!suite) {
    return { success: false, error: "Test suite not found" };
  }

  const itemsResult = parseItems(getFormValue(formData, "items"));
  if (!itemsResult.ok) {
    return { success: false, error: itemsResult.error };
  }

  const parsed = CreateTestSchema.safeParse({
    name: getFormValue(formData, "name"),
    description: getFormValue(formData, "description"),
    items: itemsResult.value,
  });

  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    return { success: false, error: issue.message };
  }

  try {
    const test = await prisma.test.create({
      data: {
        testSuiteId: suiteId,
        name: parsed.data.name,
        description: parsed.data.description,
        items: {
          create: parsed.data.items.map((item, index) => ({
            position: index,
            type: item.type,
            content: item.content,
          })),
        },
      },
    });

    revalidatePath(`/orgs/${orgId}/suites/${suiteId}`);
    redirect(`/orgs/${orgId}/suites/${suiteId}/tests/${test.id}`);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: "A test with this name already exists in the suite",
      };
    }
    throw error;
  }
}

export async function updateTest(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const orgId = getFormValue(formData, "orgId");
  const suiteId = getFormValue(formData, "suiteId");
  const testId = getFormValue(formData, "testId");

  if (!orgId || !suiteId || !testId) {
    return { success: false, error: "Test not found" };
  }

  const membership = await requireMembership(orgId, session.user.id);
  if (!membership) {
    return { success: false, error: "Organization not found" };
  }

  const test = await findTestOrNull(orgId, suiteId, testId);
  if (!test) {
    return { success: false, error: "Test not found" };
  }

  const rawItems = getFormValue(formData, "items");
  const itemsResult = rawItems
    ? parseItems(rawItems)
    : ({ ok: true, value: undefined } as const);
  if (!itemsResult.ok) {
    return { success: false, error: itemsResult.error };
  }

  const parsed = UpdateTestSchema.safeParse({
    name: getFormValue(formData, "name"),
    description: getFormValue(formData, "description"),
    items: itemsResult.value,
  });

  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    return { success: false, error: issue.message };
  }

  if (parsed.data.name && parsed.data.name !== test.name) {
    const conflict = await prisma.test.findUnique({
      where: { testSuiteId_name: { testSuiteId: suiteId, name: parsed.data.name } },
    });
    if (conflict) {
      return {
        success: false,
        error: "A test with this name already exists in the suite",
      };
    }
  }

  await prisma.$transaction(async (tx) => {
    if (parsed.data.items) {
      await tx.testItem.deleteMany({ where: { testId } });
    }

    await tx.test.update({
      where: { id: testId },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        ...(parsed.data.items
          ? {
              items: {
                create: parsed.data.items.map((item, index) => ({
                  position: index,
                  type: item.type,
                  content: item.content,
                })),
              },
            }
          : {}),
      },
    });
  });

  revalidatePath(`/orgs/${orgId}/suites/${suiteId}/tests/${testId}`);
  redirect(`/orgs/${orgId}/suites/${suiteId}/tests/${testId}`);
}

export async function deleteTest(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const orgId = getFormValue(formData, "orgId");
  const suiteId = getFormValue(formData, "suiteId");
  const testId = getFormValue(formData, "testId");

  if (!orgId || !suiteId || !testId) {
    throw new Error("Test not found");
  }

  const membership = await requireMembership(orgId, session.user.id);
  if (!membership) {
    throw new Error("Organization not found");
  }

  const test = await findTestOrNull(orgId, suiteId, testId);
  if (!test) {
    throw new Error("Test not found");
  }

  await prisma.test.delete({ where: { id: testId } });
  revalidatePath(`/orgs/${orgId}/suites/${suiteId}`);
  redirect(`/orgs/${orgId}/suites/${suiteId}`);
}
