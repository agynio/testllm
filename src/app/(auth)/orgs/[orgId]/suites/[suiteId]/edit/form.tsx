"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { updateSuite } from "@/actions/suites";
import type { ActionResult } from "@/actions/orgs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ActionState = ActionResult;

const initialState: ActionState = { success: false, error: "" };

type EditSuiteFormProps = {
  orgId: string;
  suiteId: string;
  name: string;
  description: string | null;
};

export function EditSuiteForm({
  orgId,
  suiteId,
  name,
  description,
}: EditSuiteFormProps) {
  const [state, formAction, pending] = useActionState(
    updateSuite,
    initialState
  );

  return (
    <form action={formAction} className="space-y-6">
      <input name="orgId" type="hidden" value={orgId} />
      <input name="suiteId" type="hidden" value={suiteId} />
      <div className="space-y-2">
        <Label htmlFor="suite-name">Name</Label>
        <Input
          id="suite-name"
          name="name"
          defaultValue={name}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="suite-description">Description</Label>
        <Textarea
          id="suite-description"
          name="description"
          defaultValue={description ?? ""}
          className="min-h-[110px]"
        />
      </div>
      {state.success === false && state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild>
          <Link href={`/orgs/${orgId}/suites/${suiteId}`}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          Save Changes
        </Button>
      </div>
    </form>
  );
}
