import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { CreateOrgTokenDialog } from "@/app/(auth)/orgs/[orgId]/tokens/create-org-token-dialog";
import { OrgTokenActions } from "@/app/(auth)/orgs/[orgId]/tokens/org-token-actions";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { RelativeTime } from "@/components/relative-time";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";

const TOKEN_MASK = "********";

export default async function OrgTokensPage({
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

  const tokens = await prisma.orgApiToken.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Tokens"
        description="Manage organization API tokens."
        actions={<CreateOrgTokenDialog orgId={orgId} />}
      />

      {tokens.length === 0 ? (
        <EmptyState
          title="No tokens yet"
          description="Create an organization API token to get started."
          action={<CreateOrgTokenDialog orgId={orgId} />}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Token</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((token) => (
              <TableRow key={token.id}>
                <TableCell className="font-medium">{token.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{token.role}</Badge>
                </TableCell>
                <TableCell>
                  <code className="rounded bg-muted px-2 py-1 text-sm font-mono">
                    {token.tokenPrefix}
                    {TOKEN_MASK}
                  </code>
                </TableCell>
                <TableCell>
                  {token.expiresAt ? (
                    <RelativeTime value={token.expiresAt} />
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Never
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {token.lastUsedAt ? (
                    <RelativeTime value={token.lastUsedAt} />
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Never
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <RelativeTime value={token.createdAt} />
                </TableCell>
                <TableCell className="text-right">
                  <OrgTokenActions orgId={orgId} tokenId={token.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
