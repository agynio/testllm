"use client";

import * as React from "react";
import { toast } from "sonner";
import { useActionState } from "react";
import { createInvite } from "@/actions/invites";
import type { ActionResult } from "@/actions/orgs";
import { Button } from "@/components/ui/button";

type ActionState = ActionResult;

const initialState: ActionState = { success: false, error: "" };

type InviteActionsProps = {
  orgId: string;
};

export function InviteActions({ orgId }: InviteActionsProps) {
  const [state, formAction, pending] = useActionState(
    createInvite,
    initialState
  );
  const previous = React.useRef<ActionState>(initialState);

  React.useEffect(() => {
    if (state.success && state !== previous.current) {
      toast.success("Invite created");
    }
    const error = state.success ? undefined : state.error;
    const previousError = previous.current.success
      ? undefined
      : previous.current.error;
    if (error && error !== previousError) {
      toast.error(error);
    }
    previous.current = state;
  }, [state]);

  return (
    <form action={formAction}>
      <input name="orgId" type="hidden" value={orgId} />
      <Button type="submit" disabled={pending}>
        Create Invite
      </Button>
    </form>
  );
}
