import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { auth } from "@/auth";
import { removeMember } from "@/actions/members";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { MemberRoleSelect } from "@/app/(auth)/orgs/[orgId]/members/role-select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    notFound();
  }

  const currentMembership = await prisma.orgMembership.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  });

  if (!currentMembership) {
    notFound();
  }

  const memberships = await prisma.orgMembership.findMany({
    where: { orgId },
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const adminCount = memberships.filter((member) => member.role === "admin")
    .length;
  const isAdmin = currentMembership.role === "admin";

  return (
    <div className="space-y-6">
      <PageHeader title="Members" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {memberships.map((membership) => {
            const isSelf = membership.user.id === session.user.id;
            const isLastAdmin =
              membership.role === "admin" && adminCount <= 1;

            return (
              <TableRow key={membership.id}>
                <TableCell className="font-medium">
                  {membership.user.name}
                  {isSelf ? " (You)" : ""}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {membership.user.email}
                </TableCell>
                <TableCell>
                  {isAdmin && !isSelf ? (
                    <MemberRoleSelect
                      orgId={orgId}
                      membershipId={membership.id}
                      role={membership.role}
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {membership.role}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {isAdmin && !isSelf && !isLastAdmin ? (
                    <ConfirmDialog
                      title="Remove member"
                      description={`Remove ${membership.user.name} from this organization?`}
                      confirmLabel="Remove"
                      variant="destructive"
                      action={removeMember}
                      trigger={
                        <Button variant="ghost" size="icon-sm">
                          <Trash2 className="size-4" />
                          <span className="sr-only">Remove member</span>
                        </Button>
                      }
                    >
                      <input name="orgId" type="hidden" value={orgId} />
                      <input
                        name="membershipId"
                        type="hidden"
                        value={membership.id}
                      />
                    </ConfirmDialog>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
