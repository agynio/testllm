"use client";

import { ChevronDown, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type UserMenuProps = {
  user: {
    name: string | null;
    email: string | null;
  };
  onSignOut: (formData: FormData) => Promise<void>;
};

export function UserMenu({ user, onSignOut }: UserMenuProps) {
  const displayName = user.name ?? "Account";
  const displayEmail = user.email ?? "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="gap-2" variant="ghost">
          <UserCircle className="size-5 text-muted-foreground" />
          <span className="hidden text-sm font-medium sm:inline">
            {displayName}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="space-y-1">
          <p className="text-sm font-medium leading-none">{displayName}</p>
          {displayEmail ? (
            <p className="text-xs text-muted-foreground">{displayEmail}</p>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form action={onSignOut}>
          <DropdownMenuItem asChild>
            <button className="w-full text-left" type="submit">
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
