import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) {
    redirect("/");
  }

  const userName = session.user.name;
  const userEmail = session.user.email;

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-6 px-6 py-24 font-sans">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Dashboard
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Welcome, {userName}.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {userEmail}
          </p>
        </header>
        <section className="text-base text-slate-600 dark:text-slate-300">
          Your organizations and test suites will appear here soon.
        </section>
      </main>
    </div>
  );
}
