import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { deleteOrganization } from "@/actions/orgs";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { PageHeader } from "@/components/page-header";
import { OrgSettingsForm } from "@/app/(auth)/orgs/[orgId]/settings/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export default async function OrgSettingsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    notFound();
  }

  const membership = await prisma.orgMembership.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
    include: { org: true },
  });

  if (!membership || membership.role !== "admin") {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />
      <OrgSettingsForm
        orgId={orgId}
        name={membership.org.name}
        slug={membership.org.slug}
      />
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Delete the organization and all related data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfirmDeleteDialog
            orgId={orgId}
            orgName={membership.org.name}
            orgSlug={membership.org.slug}
            action={deleteOrganization}
          />
        </CardContent>
      </Card>
    </div>
  );
}
