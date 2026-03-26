"use client";

import { deletePersonalToken } from "@/actions/tokens";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";

type PersonalTokenActionsProps = {
  tokenId: string;
};

export function PersonalTokenActions({ tokenId }: PersonalTokenActionsProps) {
  return (
    <ConfirmDialog
      title="Delete token"
      description="This will revoke the token immediately."
      confirmLabel="Delete"
      variant="destructive"
      action={deletePersonalToken}
      trigger={<Button variant="ghost">Delete</Button>}
    >
      <input name="tokenId" type="hidden" value={tokenId} />
    </ConfirmDialog>
  );
}
