"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { createOrganization } from "@/actions/orgs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function CreateOrgForm() {
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [state, formAction, pending] = useActionState(
    createOrganization,
    null
  );

  React.useEffect(() => {
    if (!slugTouched) {
      setSlug(toSlug(name));
    }
  }, [name, slugTouched]);

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="org-name">Name</Label>
        <Input
          id="org-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="My organization"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="org-slug">Slug</Label>
        <Input
          id="org-slug"
          name="slug"
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value);
          }}
          placeholder="my-organization"
          className="font-mono"
          required
        />
      </div>
      {state?.success === false && state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild>
          <Link href="/dashboard">Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          Create
        </Button>
      </div>
    </form>
  );
}
