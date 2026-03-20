"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getFormValue, requireAdmin } from "@/actions/helpers";
import type { ActionResult } from "@/actions/types";
import { prisma } from "@/lib/prisma";

export async function createInvite(
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

  const membership = await requireAdmin(orgId, session.user.id);
  if (!membership) {
    return { success: false, error: "You do not have access to invite members" };
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.invite.create({
    data: { orgId, token, expiresAt },
  });

  revalidatePath(`/orgs/${orgId}/invites`);
  return { success: true };
}

export async function deleteInvite(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const orgId = getFormValue(formData, "orgId");
  const inviteId = getFormValue(formData, "inviteId");

  if (!orgId || !inviteId) {
    throw new Error("Invite not found");
  }

  const membership = await requireAdmin(orgId, session.user.id);
  if (!membership) {
    throw new Error("You do not have access to delete invites");
  }

  const invite = await prisma.invite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.orgId !== orgId) {
    throw new Error("Invite not found");
  }

  await prisma.invite.delete({ where: { id: inviteId } });
  revalidatePath(`/orgs/${orgId}/invites`);
}

export async function acceptInvite(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const token = getFormValue(formData, "token");
  if (!token) {
    return { success: false, error: "Invite not found" };
  }

  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite) {
    return { success: false, error: "Invite not found" };
  }

  if (invite.expiresAt < new Date()) {
    return { success: false, error: "Invite has expired" };
  }

  const existingMembership = await prisma.orgMembership.findUnique({
    where: {
      orgId_userId: {
        orgId: invite.orgId,
        userId: session.user.id,
      },
    },
  });

  if (existingMembership) {
    return { success: false, error: "You are already a member" };
  }

  await prisma.$transaction([
    prisma.orgMembership.create({
      data: { orgId: invite.orgId, userId: session.user.id, role: "member" },
    }),
    prisma.invite.delete({ where: { id: invite.id } }),
  ]);

  revalidatePath(`/orgs/${invite.orgId}/suites`);
  redirect(`/orgs/${invite.orgId}/suites`);
}
