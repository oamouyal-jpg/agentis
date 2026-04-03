"use client";

import Link from "next/link";
import { QuestionVoteRatioBar } from "./InsightCharts";

export function InsightQuestionCard({
  title,
  description,
  clusterId,
  totalVotes,
  yesRatio,
  noRatio,
  extraLabel,
  href,
}: {
  title: string;
  description: string;
  clusterId: string;
  totalVotes: number;
  yesRatio: number;
  noRatio: number;
  extraLabel?: string;
  href: string;
}) {
  return (
    <article className="rounded-sm border border-zinc-800 bg-zinc-950/50 p-5">
      <div className="mb-3 inline-flex rounded-sm border border-zinc-700 bg-zinc-900/80 px-2 py-0.5 font-mono text-[10px] text-zinc-500">
        {clusterId}
      </div>

      <h3 className="font-display text-lg font-medium text-zinc-50">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{description}</p>

      <QuestionVoteRatioBar yesRatio={yesRatio} noRatio={noRatio} />

      <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
        <span className="rounded-sm border border-zinc-700 px-2 py-1 text-zinc-400">
          {totalVotes} votes
        </span>
        {extraLabel && (
          <span className="rounded-sm border border-zinc-700 px-2 py-1 text-zinc-500">
            {extraLabel}
          </span>
        )}
      </div>

      <div className="mt-5">
        <Link
          href={href}
          className="inline-flex rounded-sm border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900 hover:text-zinc-100"
        >
          Open question
        </Link>
      </div>
    </article>
  );
}
