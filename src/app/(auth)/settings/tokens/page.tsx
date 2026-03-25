import { auth } from "@/auth";
import { CreatePersonalTokenDialog } from "@/app/(auth)/settings/tokens/create-personal-token-dialog";
import { PersonalTokenActions } from "@/app/(auth)/settings/tokens/personal-token-actions";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { RelativeTime } from "@/components/relative-time";
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

export default async function PersonalTokensPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Expected authenticated session");
  }

  const tokens = await prisma.personalApiToken.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Tokens"
        description="Manage personal API tokens for TestLLM."
        actions={<CreatePersonalTokenDialog />}
      />

      {tokens.length === 0 ? (
        <EmptyState
          title="No tokens yet"
          description="Create a personal API token to get started."
          action={<CreatePersonalTokenDialog />}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
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
                  <PersonalTokenActions tokenId={token.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
