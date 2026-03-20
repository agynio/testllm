import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { deleteInvite } from "@/actions/invites";
import { InviteActions } from "@/app/(auth)/orgs/[orgId]/invites/invite-actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CopyButton } from "@/components/copy-button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { RelativeTime } from "@/components/relative-time";
import { Badge } from "@/components/ui/badge";
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

export default async function InvitesPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Expected authenticated session");
  }

  const membership = await prisma.orgMembership.findUnique({
    where: { orgId_userId: { orgId, userId } },
    include: { org: true },
  });

  if (!membership || membership.role !== "admin") {
    notFound();
  }

  const inviteList = await prisma.invite.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });

  const headerList = await headers();
  const baseUrl = process.env.AUTH_URL ?? headerList.get("origin") ?? "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invites"
        actions={<InviteActions orgId={orgId} />}
      />

      {inviteList.length === 0 ? (
        <EmptyState
          title="No invites yet"
          description="Create an invite to add a new member."
          action={<InviteActions orgId={orgId} />}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invite Link</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inviteList.map((invite) => {
              const expired = invite.expiresAt < new Date();
              const inviteUrl = baseUrl
                ? `${baseUrl}/invite/${invite.token}`
                : `/invite/${invite.token}`;

              return (
                <TableRow key={invite.id}>
                  <TableCell className="max-w-[360px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={inviteUrl}
                        className={
                          "truncate font-mono text-sm text-foreground hover:underline" +
                          (expired ? " text-muted-foreground line-through" : "")
                        }
                      >
                        {inviteUrl}
                      </Link>
                      <CopyButton value={inviteUrl} size="icon-sm" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <RelativeTime value={invite.expiresAt} />
                      {expired ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <ConfirmDialog
                      title="Delete invite"
                      description="This will revoke the invite link."
                      confirmLabel="Delete"
                      variant="destructive"
                      action={deleteInvite}
                      trigger={<Button variant="ghost">Delete</Button>}
                    >
                      <input name="orgId" type="hidden" value={orgId} />
                      <input
                        name="inviteId"
                        type="hidden"
                        value={invite.id}
                      />
                    </ConfirmDialog>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
