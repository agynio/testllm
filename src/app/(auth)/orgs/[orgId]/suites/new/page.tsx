import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CreateSuiteForm } from "@/app/(auth)/orgs/[orgId]/suites/new/form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export default async function NewSuitePage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/orgs/${orgId}/suites`} className="flex items-center gap-2">
          <ChevronLeft className="size-4" />
          Back to Suites
        </Link>
      </Button>
      <PageHeader
        title="Create Test Suite"
        description="Add a new suite to organize your tests."
      />
      <CreateSuiteForm orgId={orgId} />
    </div>
  );
}
