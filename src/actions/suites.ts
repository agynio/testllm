"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { findSuiteOrNull } from "@/lib/test-helpers";
import {
  CreateSuiteSchema,
  UpdateSuiteSchema,
} from "@/lib/schemas/suites";
import type { ActionResult } from "@/actions/orgs";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

async function requireMembership(orgId: string, userId: string) {
  return prisma.orgMembership.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
}

export async function createSuite(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const orgId = getFormValue(formData, "orgId");
  if (!orgId) {
    return { success: false, error: "Organization not found" };
  }

  const membership = await requireMembership(orgId, session.user.id);
  if (!membership) {
    return { success: false, error: "Organization not found" };
  }

  const parsed = CreateSuiteSchema.safeParse({
    name: getFormValue(formData, "name"),
    description: getFormValue(formData, "description"),
  });

  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    return { success: false, error: issue?.message ?? "Invalid input" };
  }

  try {
    const suite = await prisma.testSuite.create({
      data: {
        orgId,
        name: parsed.data.name,
        description: parsed.data.description,
      },
    });

    revalidatePath(`/orgs/${orgId}/suites`);
    redirect(`/orgs/${orgId}/suites/${suite.id}`);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: "A test suite with this name already exists in the organization",
      };
    }
    throw error;
  }
}

export async function updateSuite(
  _prevState: ActionResult,
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

  const parsed = UpdateSuiteSchema.safeParse({
    name: getFormValue(formData, "name"),
    description: getFormValue(formData, "description"),
  });

  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    return { success: false, error: issue?.message ?? "Invalid input" };
  }

  if (parsed.data.name && parsed.data.name !== suite.name) {
    const conflict = await prisma.testSuite.findUnique({
      where: { orgId_name: { orgId, name: parsed.data.name } },
    });
    if (conflict) {
      return {
        success: false,
        error: "A test suite with this name already exists in the organization",
      };
    }
  }

  await prisma.testSuite.update({
    where: { id: suiteId },
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
    },
  });

  revalidatePath(`/orgs/${orgId}/suites/${suiteId}`);
  redirect(`/orgs/${orgId}/suites/${suiteId}`);
}

export async function deleteSuite(formData: FormData): Promise<ActionResult> {
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

  await prisma.testSuite.delete({ where: { id: suiteId } });
  revalidatePath(`/orgs/${orgId}/suites`);
  redirect(`/orgs/${orgId}/suites`);
}
