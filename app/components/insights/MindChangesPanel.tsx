"use client";

import Link from "next/link";

export type MindChangesInsight = {
  total: number;
  yesToNo: number;
  noToYes: number;
  shareOfVoters: number;
  medianMsToFlip: number | null;
  medianTimeLabel: string | null;
  topQuestions: Array<{ questionId: number; title: string; flipCount: number }>;
};

type Props = {
  mindChanges: MindChangesInsight;
  questionHref: (questionId: number) => string;
};

export function MindChangesPanel({ mindChanges, questionHref }: Props) {
  const {
    total,
    yesToNo,
    noToYes,
    shareOfVoters,
    medianTimeLabel,
    topQuestions,
  } = mindChanges;

  const pctWhole = Math.round(shareOfVoters * 100);

  return (
    <div className="rounded-sm border border-zinc-800 bg-zinc-900/25 p-8">
      <h2 className="font-display text-lg font-medium text-zinc-100">
        Changing minds
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-500">
        Voters may use one switch per question (Yes ↔ No). Counts below are how
        often that switch happened, and how long after their first vote it
        typically occurred.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-sm border border-zinc-800 bg-zinc-950/40 p-4">
          <p className="text-xs font-medium text-zinc-500">Mind changes</p>
          <p className="mt-2 font-display text-2xl font-medium tabular-nums text-zinc-50">
            {total}
          </p>
        </div>
        <div className="rounded-sm border border-zinc-800 bg-zinc-950/40 p-4">
          <p className="text-xs font-medium text-zinc-500">Share of voters</p>
          <p className="mt-2 font-display text-2xl font-medium tabular-nums text-zinc-50">
            {pctWhole}%
          </p>
          <p className="mt-1 text-[11px] text-zinc-600">of current vote total</p>
        </div>
        <div className="rounded-sm border border-zinc-800 bg-zinc-950/40 p-4">
          <p className="text-xs font-medium text-zinc-500">Yes → No</p>
          <p className="mt-2 font-display text-2xl font-medium tabular-nums text-zinc-50">
            {yesToNo}
          </p>
        </div>
        <div className="rounded-sm border border-zinc-800 bg-zinc-950/40 p-4">
          <p className="text-xs font-medium text-zinc-500">No → Yes</p>
          <p className="mt-2 font-display text-2xl font-medium tabular-nums text-zinc-50">
            {noToYes}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Median time to switch
          </p>
          <p className="mt-2 font-display text-xl font-medium text-zinc-100">
            {medianTimeLabel ?? "—"}
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            After first vote on that question (same device).
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Most switches by question
          </p>
          {topQuestions.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">No vote changes yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {topQuestions.map((row) => (
                <li key={row.questionId} className="flex items-baseline justify-between gap-3 text-sm">
                  <Link
                    href={questionHref(row.questionId)}
                    className="min-w-0 truncate text-zinc-300 underline decoration-zinc-700 underline-offset-2 transition hover:text-zinc-100 hover:decoration-zinc-500"
                  >
                    {row.title}
                  </Link>
                  <span className="shrink-0 tabular-nums text-zinc-500">
                    {row.flipCount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
