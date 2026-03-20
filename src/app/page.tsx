import Link from "next/link";
import { auth, signIn } from "@/auth";

export default async function Home() {
  const session = await auth();
  const signInAction = async () => {
    "use server";
    await signIn("oidc");
  };

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-10 px-6 py-24 font-sans sm:gap-12">
        <header className="space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            TestLLM
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Deterministic LLM service for E2E testing of AI agents
          </p>
        </header>
        <section className="space-y-6 text-base text-slate-600 dark:text-slate-300">
          <p>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              What it does.
            </span>{" "}
            TestLLM lets you create scripted conversation sequences so your AI
            agents receive deterministic, repeatable responses during testing.
          </p>
          <p>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              Why it matters.
            </span>{" "}
            Real LLMs are non-deterministic, so the same prompt can produce
            different outputs and make E2E tests unreliable. TestLLM fixes this
            by acting as a drop-in LLM replacement that returns exact, scripted
            responses.
          </p>
          <p>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              How it works.
            </span>{" "}
            Define a test conversation with inputs and expected outputs, point
            your agent at TestLLM instead of a real LLM, and get the exact same
            behavior every time.
          </p>
          <div className="pt-2">
            {session ? (
              <Link
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                href="/"
              >
                Get Started
              </Link>
            ) : (
              <form action={signInAction}>
                <button
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                  type="submit"
                >
                  Sign In
                </button>
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
