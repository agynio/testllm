"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { createTest } from "@/actions/tests";
import type { ActionResult } from "@/actions/orgs";
import { TestItemEditor } from "@/components/test-item-editor/test-item-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ActionState = ActionResult;

const initialState: ActionState = { success: false, error: "" };

type CreateTestFormProps = {
  orgId: string;
  suiteId: string;
};

export function CreateTestForm({ orgId, suiteId }: CreateTestFormProps) {
  const [state, formAction, pending] = useActionState(
    createTest,
    initialState
  );

  return (
    <form action={formAction} className="space-y-6">
      <input name="orgId" type="hidden" value={orgId} />
      <input name="suiteId" type="hidden" value={suiteId} />
      <div className="space-y-2">
        <Label htmlFor="test-name">Name</Label>
        <Input id="test-name" name="name" placeholder="happy-path" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="test-description">Description</Label>
        <Textarea
          id="test-description"
          name="description"
          placeholder="Agent correctly reports weather"
          className="min-h-[110px]"
        />
      </div>
      <div className="space-y-3">
        <Label>Conversation Items</Label>
        <TestItemEditor inputName="items" />
      </div>
      {state.success === false && state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild>
          <Link href={`/orgs/${orgId}/suites/${suiteId}`}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          Create
        </Button>
      </div>
    </form>
  );
}
