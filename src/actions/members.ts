"use server";

import { auth } from "@/auth";
import { getFormValue, requireAdmin } from "@/actions/helpers";
import type { ActionResult } from "@/actions/types";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type UpdateMemberRoleArgs = {
  orgId: string;
  membershipId: string;
  role: "admin" | "member";
};

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

  const membership = await requireAdmin(orgId, session.user.id);
  if (!membership) {
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

export async function removeMember(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const orgId = getFormValue(formData, "orgId");
  const membershipId = getFormValue(formData, "membershipId");

  if (!orgId || !membershipId) {
    throw new Error("Member not found");
  }

  const membership = await requireAdmin(orgId, session.user.id);
  if (!membership) {
    throw new Error("You do not have access to remove members");
  }

  const existing = await prisma.orgMembership.findUnique({
    where: { id: membershipId },
  });
  if (!existing || existing.orgId !== orgId) {
    throw new Error("Member not found");
  }

  if (existing.role === "admin") {
    const adminCount = await prisma.orgMembership.count({
      where: { orgId, role: "admin" },
    });
    if (adminCount <= 1) {
      throw new Error("Cannot remove the last admin");
    }
  }

  await prisma.orgMembership.delete({ where: { id: membershipId } });
  revalidatePath(`/orgs/${orgId}/members`);
}
