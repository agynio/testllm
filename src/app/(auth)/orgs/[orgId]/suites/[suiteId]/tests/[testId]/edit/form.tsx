"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { updateTest } from "@/actions/tests";
import { TestItemEditor } from "@/components/test-item-editor/test-item-editor";
import type { TestItemDraft } from "@/components/test-item-editor/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type EditTestFormProps = {
  orgId: string;
  suiteId: string;
  testId: string;
  name: string;
  description: string | null;
  items: TestItemDraft[];
};

export function EditTestForm({
  orgId,
  suiteId,
  testId,
  name,
  description,
  items,
}: EditTestFormProps) {
  const [state, formAction, pending] = useActionState(
    updateTest,
    null
  );

  return (
    <form action={formAction} className="space-y-6">
      <input name="orgId" type="hidden" value={orgId} />
      <input name="suiteId" type="hidden" value={suiteId} />
      <input name="testId" type="hidden" value={testId} />
      <div className="space-y-2">
        <Label htmlFor="test-name">Name</Label>
        <Input id="test-name" name="name" defaultValue={name} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="test-description">Description</Label>
        <Textarea
          id="test-description"
          name="description"
          defaultValue={description ?? ""}
          className="min-h-[110px]"
        />
      </div>
      <div className="space-y-3">
        <Label>Conversation Items</Label>
        <TestItemEditor inputName="items" initialItems={items} />
      </div>
      {state?.success === false && state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild>
          <Link href={`/orgs/${orgId}/suites/${suiteId}/tests/${testId}`}>
            Cancel
          </Link>
        </Button>
        <Button type="submit" disabled={pending}>
          Save Changes
        </Button>
      </div>
    </form>
  );
}
