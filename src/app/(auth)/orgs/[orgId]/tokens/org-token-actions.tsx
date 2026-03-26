"use client";

import { deleteOrgToken } from "@/actions/tokens";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";

type OrgTokenActionsProps = {
  orgId: string;
  tokenId: string;
};

export function OrgTokenActions({ orgId, tokenId }: OrgTokenActionsProps) {
  return (
    <ConfirmDialog
      title="Delete token"
      description="This will revoke the token immediately."
      confirmLabel="Delete"
      variant="destructive"
      action={deleteOrgToken}
      trigger={<Button variant="ghost">Delete</Button>}
    >
      <input name="orgId" type="hidden" value={orgId} />
      <input name="tokenId" type="hidden" value={tokenId} />
    </ConfirmDialog>
  );
}
