"use client";

import * as React from "react";
import { toast } from "sonner";
import { useActionState } from "react";
import { createInvite } from "@/actions/invites";
import type { ActionResult } from "@/actions/types";
import { Button } from "@/components/ui/button";

type ActionState = ActionResult | null;

type InviteActionsProps = {
  orgId: string;
};

export function InviteActions({ orgId }: InviteActionsProps) {
  const [state, formAction, pending] = useActionState(
    createInvite,
    null
  );
  const previous = React.useRef<ActionState>(null);

  React.useEffect(() => {
    if (!state) {
      return;
    }
    if (state.success && state !== previous.current) {
      toast.success("Invite created");
    }
    const error = state.success ? undefined : state.error;
    const previousError = previous.current?.success
      ? undefined
      : previous.current?.error;
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
