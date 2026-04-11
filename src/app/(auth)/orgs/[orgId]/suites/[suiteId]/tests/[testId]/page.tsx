import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { deleteTest } from "@/actions/tests";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CopyButton } from "@/components/copy-button";
import { PageHeader } from "@/components/page-header";
import { TestItemList } from "@/components/test-item-list";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { findTestOrNull } from "@/lib/test-helpers";
import { mapPrismaItemsToListItems } from "@/lib/test-item-mappers";

export default async function TestDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; suiteId: string; testId: string }>;
}) {
  const { orgId, suiteId, testId } = await params;

  const test = await findTestOrNull(orgId, suiteId, testId);
  if (!test) {
    notFound();
  }

  const items = await prisma.testItem.findMany({
    where: { testId },
    orderBy: { position: "asc" },
  });

  const listItems = mapPrismaItemsToListItems(items);
  const endpointPath =
    test.testSuite.protocol === "anthropic" ? "messages" : "responses";
  const endpoint = `https://testllm.dev/v1/org/${test.testSuite.org.slug}/suite/${test.testSuite.name}/${endpointPath}`;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link
          href={`/orgs/${orgId}/suites/${suiteId}`}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="size-4" />
          Back to {test.testSuite.name}
        </Link>
      </Button>

      <PageHeader
        title={test.name}
        description={test.description ?? "No description provided."}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link
                href={`/orgs/${orgId}/suites/${suiteId}/tests/${testId}/edit`}
              >
                Edit
              </Link>
            </Button>
            <ConfirmDialog
              title="Delete test"
              description="This will permanently delete the test and its items."
              confirmLabel="Delete"
              variant="destructive"
              action={deleteTest}
              trigger={<Button variant="destructive">Delete</Button>}
            >
              <input name="orgId" type="hidden" value={orgId} />
              <input name="suiteId" type="hidden" value={suiteId} />
              <input name="testId" type="hidden" value={testId} />
            </ConfirmDialog>
          </div>
        }
      />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Conversation Sequence</h2>
        <TestItemList items={listItems} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Model Name</CardTitle>
          <CardDescription>
            Use this test name as the model field in API requests.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <code className="rounded bg-muted px-2 py-1 text-sm font-mono">
            {test.name}
          </code>
          <CopyButton value={test.name} showLabel />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Endpoint</CardTitle>
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
