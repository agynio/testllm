import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CreateOrgForm } from "@/app/(auth)/orgs/new/form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export default function NewOrgPage() {
  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard" className="flex items-center gap-2">
          <ChevronLeft className="size-4" />
          Back to Dashboard
        </Link>
      </Button>
      <PageHeader
        title="Create Organization"
        description="Set up a new organization for your team."
      />
      <CreateOrgForm />
    </div>
  );
}
