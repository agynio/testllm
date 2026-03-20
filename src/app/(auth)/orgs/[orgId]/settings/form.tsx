"use client";

import * as React from "react";
import { useActionState } from "react";
import { updateOrganization } from "@/actions/orgs";
import type { ActionResult } from "@/actions/orgs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ActionState = ActionResult;

const initialState: ActionState = { success: false, error: "" };

type OrgSettingsFormProps = {
  orgId: string;
  name: string;
  slug: string;
};

export function OrgSettingsForm({ orgId, name, slug }: OrgSettingsFormProps) {
  const [state, formAction, pending] = useActionState(
    updateOrganization,
    initialState
  );

  return (
    <form action={formAction} className="space-y-4">
      <input name="orgId" type="hidden" value={orgId} />
      <div className="space-y-2">
        <Label htmlFor="org-name">Organization Name</Label>
        <Input id="org-name" name="name" defaultValue={name} required />
        <p className="text-xs text-muted-foreground">Slug: {slug}</p>
      </div>
      {state.success === false && state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          Save Changes
        </Button>
      </div>
    </form>
  );
}
