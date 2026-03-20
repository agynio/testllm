import * as React from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { OrgNav } from "@/components/org-nav";
import { OrgProvider } from "@/components/org-provider";
import { prisma } from "@/lib/prisma";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const membership = await prisma.orgMembership.findUnique({
    where: {
      orgId_userId: {
        orgId,
        userId: session.user.id,
      },
    },
    include: { org: true },
  });

  if (!membership) {
    notFound();
  }

  return (
    <OrgProvider
      value={{
        orgId,
        orgName: membership.org.name,
        orgSlug: membership.org.slug,
        role: membership.role,
      }}
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {membership.org.name}
          </h1>
          <OrgNav />
        </div>
        {children}
      </div>
    </OrgProvider>
  );
}
