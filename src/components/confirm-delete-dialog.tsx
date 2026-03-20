"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/actions/types";

type ConfirmDeleteDialogProps = {
  orgId: string;
  orgName: string;
  orgSlug: string;
  action: (
    prevState: ActionResult | null,
    formData: FormData
  ) => Promise<ActionResult> | ActionResult;
};

export function ConfirmDeleteDialog({
  orgId,
  orgName,
  orgSlug,
  action,
}: ConfirmDeleteDialogProps) {
  const [confirmation, setConfirmation] = React.useState("");
  const [state, formAction] = React.useActionState(action, null);

  const isMatch = confirmation === orgSlug;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete Organization</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete organization</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete &quot;{orgName}&quot; and all of its test
            suites, tests, members, and invites.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="org-confirm">
            Type <span className="font-semibold">{orgSlug}</span> to confirm.
          </Label>
          <Input
            id="org-confirm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
          {state?.success === false && state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={formAction}>
            <input name="orgId" type="hidden" value={orgId} />
            <input name="confirmation" type="hidden" value={confirmation} />
            <AlertDialogAction
              type="submit"
              variant="destructive"
              disabled={!isMatch}
            >
              Delete
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
