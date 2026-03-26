"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type ExportSuiteButtonProps = {
  orgId: string;
  suiteId: string;
  suiteName: string;
};

export function ExportSuiteButton({
  orgId,
  suiteId,
  suiteName,
}: ExportSuiteButtonProps) {
  const exportUrl = `/api/orgs/${orgId}/suites/${suiteId}/export`;

  return (
    <Button variant="outline" asChild>
      <a href={exportUrl} download={`${suiteName}.json`}>
        <Download className="size-4" />
        Export
      </a>
    </Button>
  );
}
