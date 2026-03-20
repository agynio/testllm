import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
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

export default async function SuitesPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  const suites = await prisma.testSuite.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { tests: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Test Suites"
        actions={
          <Button asChild>
            <Link href={`/orgs/${orgId}/suites/new`}>New Suite</Link>
          </Button>
        }
      />

      {suites.length === 0 ? (
        <EmptyState
          title="No test suites"
          description="Create your first test suite to get started."
          action={
            <Button asChild>
              <Link href={`/orgs/${orgId}/suites/new`}>Create Suite</Link>
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Tests</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suites.map((suite) => (
              <TableRow key={suite.id}>
                <TableCell className="font-mono">
                  <Link
                    href={`/orgs/${orgId}/suites/${suite.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {suite.name}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[360px] truncate text-muted-foreground">
                  {suite.description || "—"}
                </TableCell>
                <TableCell className="text-right">
                  {suite._count.tests}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
