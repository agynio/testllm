import * as React from "react";
import { signOut } from "@/auth";
import { AppHeader } from "@/components/app-header";

type AppShellProps = {
  user: {
    name: string | null;
    email: string | null;
  };
  children: React.ReactNode;
};

export function AppShell({ user, children }: AppShellProps) {
  const signOutAction = async () => {
    "use server";
    await signOut();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader user={user} onSignOut={signOutAction} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
