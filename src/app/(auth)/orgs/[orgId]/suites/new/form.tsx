"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { createSuite } from "@/actions/suites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type CreateSuiteFormProps = {
  orgId: string;
};

export function CreateSuiteForm({ orgId }: CreateSuiteFormProps) {
  const [protocol, setProtocol] = React.useState<"openai" | "anthropic">(
    "openai"
  );
  const [state, formAction, pending] = useActionState(
    createSuite,
    null
  );

  return (
    <form action={formAction} className="space-y-6">
      <input name="orgId" type="hidden" value={orgId} />
      <div className="space-y-2">
        <Label htmlFor="suite-name">Name</Label>
        <Input
          id="suite-name"
          name="name"
          placeholder="agent-weather"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="suite-description">Description</Label>
        <Textarea
          id="suite-description"
          name="description"
          placeholder="Weather agent test scenarios"
          className="min-h-[110px]"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="suite-protocol">Protocol</Label>
        <Select
          value={protocol}
          onValueChange={(value) =>
            setProtocol(value as "openai" | "anthropic")
          }
        >
          <SelectTrigger id="suite-protocol" className="w-full">
            <SelectValue placeholder="Select protocol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="openai">OpenAI</SelectItem>
            <SelectItem value="anthropic">Anthropic</SelectItem>
          </SelectContent>
        </Select>
        <input name="protocol" type="hidden" value={protocol} />
      </div>
      {state?.success === false && state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild>
          <Link href={`/orgs/${orgId}/suites`}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          Create
        </Button>
      </div>
    </form>
  );
}
