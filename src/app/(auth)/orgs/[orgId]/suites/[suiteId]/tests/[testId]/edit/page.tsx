import Link from "next/link";
import { randomUUID } from "crypto";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EditTestForm } from "@/app/(auth)/orgs/[orgId]/suites/[suiteId]/tests/[testId]/edit/form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { findTestOrNull } from "@/lib/test-helpers";
import { mapPrismaItemsToDrafts } from "@/lib/test-item-mappers";

export default async function EditTestPage({
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

  const initialItems = mapPrismaItemsToDrafts(items, randomUUID);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link
          href={`/orgs/${orgId}/suites/${suiteId}/tests/${testId}`}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="size-4" />
          Back to Test
        </Link>
      </Button>
      <PageHeader
        title="Edit Test"
        description="Update the conversation sequence or metadata."
      />
      <EditTestForm
        orgId={orgId}
        suiteId={suiteId}
        testId={testId}
        name={test.name}
        description={test.description}
        items={initialItems}
        protocol={test.testSuite.protocol}
      />
    </div>
  );
}
