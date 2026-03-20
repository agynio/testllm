export default function Home() {
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
            Point agents at TestLLM instead of a real LLM and receive scripted,
            deterministic responses that make end-to-end behavior fully
            assertable.
          </p>
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              API surfaces
            </p>
            <ul className="space-y-2">
              <li className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  Management API
                </span>
                <code className="rounded bg-slate-100 px-2 py-0.5 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  /api/
                </code>
                <span>for configuring orgs, suites, and tests.</span>
              </li>
              <li className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  Responses API
                </span>
                <code className="rounded bg-slate-100 px-2 py-0.5 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  /v1/...
                </code>
                <span>for deterministic, OpenAI-compatible responses.</span>
              </li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
