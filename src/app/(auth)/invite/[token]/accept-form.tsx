"use client";

import * as React from "react";
import { useActionState } from "react";
import { acceptInvite } from "@/actions/invites";
import { Button } from "@/components/ui/button";

type AcceptInviteFormProps = {
  token: string;
};

export function AcceptInviteForm({ token }: AcceptInviteFormProps) {
  const [state, formAction, pending] = useActionState(
    acceptInvite,
    null
  );

  return (
    <form action={formAction} className="space-y-3">
      <input name="token" type="hidden" value={token} />
      {state?.success === false && state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        Accept Invite
      </Button>
    </form>
  );
}
