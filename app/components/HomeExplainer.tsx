"use client";

import { useI18n } from "../../lib/i18n/I18nProvider";

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M5 7.5l5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const STEP_ROWS: Array<{
  n: number;
  summaryKey:
    | "home.explainerStepSummary1"
    | "home.explainerStepSummary2"
    | "home.explainerStepSummary3";
  bodyKey: "home.explainerStep1" | "home.explainerStep2" | "home.explainerStep3";
}> = [
  { n: 1, summaryKey: "home.explainerStepSummary1", bodyKey: "home.explainerStep1" },
  { n: 2, summaryKey: "home.explainerStepSummary2", bodyKey: "home.explainerStep2" },
  { n: 3, summaryKey: "home.explainerStepSummary3", bodyKey: "home.explainerStep3" },
];

/** If a locale file is missing a key, `t` can still return the path — never show that in UI. */
function tx(
  t: (k: string) => string,
  key: string,
  fallback: string
): string {
  const v = t(key);
  return v === key ? fallback : v;
}

/**
 * Collapsible “What is Agentis?” — summary always shows real title + one-liner; steps expand below.
 */
export function HomeExplainer() {
  const { t } = useI18n();

  const title = tx(t, "home.explainerTitle", "What is Agentis?");
  const oneLiner = tx(
    t,
    "home.explainerOneLiner",
    "A simple tool for groups: write concerns, vote yes or no on clear questions, and see results in one place."
  );

  return (
    <section className="mb-8 sm:mb-10" aria-label={title}>
      <details className="group/explainer rounded-lg border border-emerald-900/40 bg-emerald-950/20 open:border-emerald-800/50">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-4 sm:px-5 sm:py-5 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-medium tracking-tight text-zinc-50 sm:text-xl">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400 sm:text-[15px]">
              {oneLiner}
            </p>
          </div>
          <Chevron className="mt-1 h-5 w-5 shrink-0 text-zinc-500 transition-transform duration-200 group-open/explainer:rotate-180" />
        </summary>

        <div className="border-t border-zinc-800/90 px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="divide-y divide-zinc-800/90 border-t border-zinc-800/80">
            {STEP_ROWS.map(({ n, summaryKey, bodyKey }) => (
              <details key={n} className="group/step">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-3.5 pl-1 pr-1 text-left [&::-webkit-details-marker]:hidden">
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-700/80 bg-zinc-900/80 text-xs font-medium text-zinc-300"
                      aria-hidden
                    >
                      {n}
                    </span>
                    <span className="text-sm font-medium text-zinc-200">
                      {tx(t, summaryKey, ["Write a concern", "Merge into one question", "Vote yes or no"][n - 1]!)}
                    </span>
                  </span>
                  <Chevron className="h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 group-open/step:rotate-180" />
                </summary>
                <div className="border-t border-zinc-800/80 bg-zinc-950/50 px-3 pb-4 pl-[3.25rem] pr-2 pt-3 text-sm leading-relaxed text-zinc-400">
                  {tx(
                    t,
                    bodyKey,
                    [
                      "Anyone in the group can write a short concern.",
                      "Similar concerns are grouped into one question.",
                      "Each question has yes and no; discussion stays on the same page.",
                    ][n - 1]!
                  )}
                </div>
              </details>
            ))}
          </div>
        </div>
      </details>
    </section>
  );
}
