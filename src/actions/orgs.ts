"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getFormValue } from "@/actions/helpers";
import type { ActionResult } from "@/actions/types";
import { prisma } from "@/lib/prisma";
import { CreateOrgSchema, UpdateOrgSchema } from "@/lib/schemas/orgs";

export async function createOrganization(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = CreateOrgSchema.safeParse({
    name: getFormValue(formData, "name"),
    slug: getFormValue(formData, "slug"),
  });

  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    return { success: false, error: issue.message };
  }

  try {
    const org = await prisma.organization.create({
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        memberships: {
          create: {
            userId: session.user.id,
            role: "admin",
          },
        },
      },
    });

    revalidatePath("/dashboard");
    redirect(`/orgs/${org.id}/suites`);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: "An organization with this slug already exists",
      };
    }
    throw error;
  }
}

export async function updateOrganization(
  _prevState: ActionResult | null,
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

  const membership = await prisma.orgMembership.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  });

  if (!membership) {
    return { success: false, error: "Organization not found" };
  }

  if (membership.role !== "admin") {
    return { success: false, error: "You do not have access to update this" };
  }

  const parsed = UpdateOrgSchema.safeParse({
    name: getFormValue(formData, "name"),
  });

  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    return { success: false, error: issue.message };
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { name: parsed.data.name },
  });

  revalidatePath(`/orgs/${orgId}/settings`);
  redirect(`/orgs/${orgId}/settings`);
}

export async function deleteOrganization(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const orgId = getFormValue(formData, "orgId");
  const confirmation = getFormValue(formData, "confirmation");

  if (!orgId) {
    return { success: false, error: "Organization not found" };
  }

  const membership = await prisma.orgMembership.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
    include: { org: true },
  });

  if (!membership) {
    return { success: false, error: "Organization not found" };
  }

  if (membership.role !== "admin") {
    return { success: false, error: "You do not have access to delete this" };
  }

  if (confirmation !== membership.org.slug) {
    return {
      success: false,
      error: `Type ${membership.org.slug} to confirm deletion`,
    };
  }

  await prisma.organization.delete({ where: { id: orgId } });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
