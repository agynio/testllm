"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { createOrgToken } from "@/actions/tokens";
import type { TokenCreateResult } from "@/actions/tokens";
import { TokenRevealDialog } from "@/components/token-reveal-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ActionState = TokenCreateResult | null;

const DEFAULT_EXPIRATION = "30d";
const DEFAULT_ROLE = "member";

const EXPIRATION_OPTIONS = [
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "never", label: "Never" },
];

const ROLE_OPTIONS = [
  { value: "member", label: "member" },
  { value: "admin", label: "admin" },
];

type CreateOrgTokenDialogProps = {
  orgId: string;
};

export function CreateOrgTokenDialog({ orgId }: CreateOrgTokenDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [token, setToken] = React.useState<string | null>(null);
  const [expiresIn, setExpiresIn] = React.useState(DEFAULT_EXPIRATION);
  const [role, setRole] = React.useState(DEFAULT_ROLE);
  const [state, formAction, pending] = useActionState(createOrgToken, null);
  const previous = React.useRef<ActionState>(null);
  const formRef = React.useRef<HTMLFormElement | null>(null);

  React.useEffect(() => {
    if (!state) {
      return;
    }

    if (state.success && state !== previous.current) {
      setOpen(false);
      setToken(state.rawToken);
      formRef.current?.reset();
      setExpiresIn(DEFAULT_EXPIRATION);
      setRole(DEFAULT_ROLE);
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
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>Create Token</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create token</DialogTitle>
            <DialogDescription>
              Generate a new organization API token.
            </DialogDescription>
          </DialogHeader>
          <form action={formAction} ref={formRef} className="space-y-4">
            <input name="orgId" type="hidden" value={orgId} />
            <div className="space-y-2">
              <Label htmlFor="org-token-name">Name</Label>
              <Input
                id="org-token-name"
                name="name"
                placeholder="CI token"
                required
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole} disabled={pending}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input name="role" type="hidden" value={role} />
            </div>
            <div className="space-y-2">
              <Label>Expiration</Label>
              <Select
                value={expiresIn}
                onValueChange={setExpiresIn}
                disabled={pending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select expiration" />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input name="expiresIn" type="hidden" value={expiresIn} />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={pending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={pending}>
                Create Token
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <TokenRevealDialog token={token} onClose={() => setToken(null)} />
    </>
  );
}
