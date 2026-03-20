import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { deleteSuite } from "@/actions/suites";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CopyButton } from "@/components/copy-button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";

export default async function SuiteDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; suiteId: string }>;
}) {
  const { orgId, suiteId } = await params;

  const suite = await prisma.testSuite.findUnique({
    where: { id: suiteId },
    include: { org: true },
  });

  if (!suite || suite.orgId !== orgId) {
    notFound();
  }

  const tests = await prisma.test.findMany({
    where: { testSuiteId: suiteId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });

  const endpoint = `https://testllm.dev/v1/org/${suite.org.slug}/suite/${suite.name}/responses`;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/orgs/${orgId}/suites`} className="flex items-center gap-2">
          <ChevronLeft className="size-4" />
          Back to Suites
        </Link>
      </Button>

      <PageHeader
        title={suite.name}
        description={suite.description ?? "No description provided."}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href={`/orgs/${orgId}/suites/${suiteId}/edit`}>Edit</Link>
            </Button>
            <ConfirmDialog
              title="Delete test suite"
              description="This will permanently delete the suite and all tests inside it."
              confirmLabel="Delete"
              variant="destructive"
              action={deleteSuite}
              trigger={<Button variant="destructive">Delete</Button>}
            >
              <input name="orgId" type="hidden" value={orgId} />
              <input name="suiteId" type="hidden" value={suiteId} />
            </ConfirmDialog>
          </div>
        }
      />

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Tests</h2>
          <Button asChild>
            <Link href={`/orgs/${orgId}/suites/${suiteId}/tests/new`}>
              New Test
            </Link>
          </Button>
        </div>

        {tests.length === 0 ? (
          <EmptyState
            title="No tests yet"
            description="Create your first test to start scripting responses."
            action={
              <Button asChild>
                <Link href={`/orgs/${orgId}/suites/${suiteId}/tests/new`}>
                  Create Test
                </Link>
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Items</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tests.map((test) => (
                <TableRow key={test.id}>
                  <TableCell className="font-mono">
                    <Link
                      href={`/orgs/${orgId}/suites/${suiteId}/tests/${test.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {test.name}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[360px] truncate text-muted-foreground">
                    {test.description || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {test._count.items}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Responses API Endpoint</CardTitle>
          <CardDescription>
            Use this endpoint when configuring your agent.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <code className="rounded bg-muted px-2 py-1 text-sm font-mono">
            {endpoint}
          </code>
          <CopyButton value={endpoint} showLabel />
        </CardContent>
      </Card>
    </div>
  );
}
