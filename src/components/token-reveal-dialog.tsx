"use client";

import * as React from "react";
import { TriangleAlert } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TokenRevealDialogProps = {
  token: string | null;
  onClose: () => void;
};

export function TokenRevealDialog({
  token,
  onClose,
}: TokenRevealDialogProps) {
  const open = Boolean(token);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Token created</DialogTitle>
          <DialogDescription>Copy this token now.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
            <code className="break-all text-sm font-mono">
              {token ?? ""}
            </code>
            {token ? <CopyButton value={token} size="icon-sm" /> : null}
          </div>
          <div className="flex gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-100">
            <TriangleAlert className="mt-0.5 size-4 text-amber-600 dark:text-amber-300" />
            <p>
              Store this token in a secure location. For security reasons, it
              will not be shown again.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
