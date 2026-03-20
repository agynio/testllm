import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EditSuiteForm } from "@/app/(auth)/orgs/[orgId]/suites/[suiteId]/edit/form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

export default async function EditSuitePage({
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
          Back to Suite
        </Link>
      </Button>
      <PageHeader
        title="Edit Test Suite"
        description="Update the name or description for this suite."
      />
      <EditSuiteForm
        orgId={orgId}
        suiteId={suiteId}
        name={suite.name}
        description={suite.description}
      />
    </div>
  );
}
