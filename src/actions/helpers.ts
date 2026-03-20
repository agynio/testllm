import { prisma } from "@/lib/prisma";

export function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

export async function requireMembership(orgId: string, userId: string) {
  return prisma.orgMembership.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
}

export async function requireAdmin(orgId: string, userId: string) {
  const membership = await requireMembership(orgId, userId);
  return membership?.role === "admin" ? membership : null;
}
