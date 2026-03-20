import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { CreateTestForm } from "@/app/(auth)/orgs/[orgId]/suites/[suiteId]/tests/new/form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

export default async function NewTestPage({
  params,
}: {
  params: Promise<{ orgId: string; suiteId: string }>;
}) {
  const { orgId, suiteId } = await params;

  const suite = await prisma.testSuite.findUnique({
    where: { id: suiteId },
  });

  if (!suite || suite.orgId !== orgId) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link
          href={`/orgs/${orgId}/suites/${suiteId}`}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="size-4" />
          Back to {suite.name}
        </Link>
      </Button>
      <PageHeader
        title="Create Test"
        description="Define a deterministic conversation sequence."
      />
      <CreateTestForm orgId={orgId} suiteId={suiteId} />
    </div>
  );
}
