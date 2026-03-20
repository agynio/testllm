"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/orgs";

type UpdateMemberRoleArgs = {
  orgId: string;
  membershipId: string;
  role: "admin" | "member";
};

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

export async function updateMemberRole({
  orgId,
  membershipId,
  role,
}: UpdateMemberRoleArgs): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  if (role !== "admin" && role !== "member") {
    return { success: false, error: "Invalid role" };
  }

  const membership = await prisma.orgMembership.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  });
  if (!membership || membership.role !== "admin") {
    return { success: false, error: "You do not have access to update roles" };
  }

  const existing = await prisma.orgMembership.findUnique({
    where: { id: membershipId },
  });
  if (!existing || existing.orgId !== orgId) {
    return { success: false, error: "Member not found" };
  }

  if (existing.role === "admin" && role === "member") {
    const adminCount = await prisma.orgMembership.count({
      where: { orgId, role: "admin" },
    });
    if (adminCount <= 1) {
      return { success: false, error: "Cannot remove the last admin" };
    }
  }

  if (existing.role !== role) {
    await prisma.orgMembership.update({
      where: { id: membershipId },
      data: { role },
    });
  }

  revalidatePath(`/orgs/${orgId}/members`);
  return { success: true };
}

export async function removeMember(
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const orgId = getFormValue(formData, "orgId");
  const membershipId = getFormValue(formData, "membershipId");

  if (!orgId || !membershipId) {
    return { success: false, error: "Member not found" };
  }

  const membership = await prisma.orgMembership.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  });
  if (!membership || membership.role !== "admin") {
    return { success: false, error: "You do not have access to remove members" };
  }

  const existing = await prisma.orgMembership.findUnique({
    where: { id: membershipId },
  });
  if (!existing || existing.orgId !== orgId) {
    return { success: false, error: "Member not found" };
  }

  if (existing.role === "admin") {
    const adminCount = await prisma.orgMembership.count({
      where: { orgId, role: "admin" },
    });
    if (adminCount <= 1) {
      return { success: false, error: "Cannot remove the last admin" };
    }
  }

  await prisma.orgMembership.delete({ where: { id: membershipId } });
  revalidatePath(`/orgs/${orgId}/members`);
  return { success: true };
}
