"use client";

import * as React from "react";
import { toast } from "sonner";
import { updateMemberRole } from "@/actions/members";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type MemberRoleSelectProps = {
  orgId: string;
  membershipId: string;
  role: "admin" | "member";
};

export function MemberRoleSelect({
  orgId,
  membershipId,
  role,
}: MemberRoleSelectProps) {
  const [isPending, startTransition] = React.useTransition();
  const [currentRole, setCurrentRole] = React.useState(role);

  React.useEffect(() => {
    setCurrentRole(role);
  }, [role]);

  const handleChange = (value: string) => {
    const nextRole = value as "admin" | "member";
    const previousRole = currentRole;
    setCurrentRole(nextRole);
    startTransition(async () => {
      const result = await updateMemberRole({
        orgId,
        membershipId,
        role: nextRole,
      });

      if (!result.success) {
        setCurrentRole(previousRole);
        toast.error(result.error ?? "Unable to update role");
      } else {
        toast.success("Role updated");
      }
    });
  };

  return (
    <Select
      value={currentRole}
      onValueChange={handleChange}
      disabled={isPending}
    >
      <SelectTrigger className="w-[120px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">admin</SelectItem>
        <SelectItem value="member">member</SelectItem>
      </SelectContent>
    </Select>
  );
}
