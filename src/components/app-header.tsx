"use client";

import Link from "next/link";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/utils";

type AppHeaderProps = {
  user: {
    name: string | null;
    email: string | null;
  };
  onSignOut: (formData: FormData) => Promise<void>;
};

export function AppHeader({ user, onSignOut }: AppHeaderProps) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link className="text-lg font-semibold" href="/dashboard">
            TestLLM
          </Link>
          <Link
            className={cn(
              "text-sm font-medium text-muted-foreground transition hover:text-foreground"
            )}
            href="/dashboard"
          >
            Dashboard
          </Link>
        </div>
        <UserMenu user={user} onSignOut={onSignOut} />
      </div>
    </header>
  );
}
