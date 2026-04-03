"use client";

import Link from "next/link";

type ClusterRow = { clusterId: string; totalVotes: number };

type QuestionRow = { id: number; title: string; totalVotes: number };

/** Stacked bar: all yes vs all no votes in the space. */
export function OverviewVoteSplitChart({
  totalYes,
  totalNo,
}: {
  totalYes: number;
  totalNo: number;
}) {
  const total = totalYes + totalNo;
  if (total === 0) {
    return (
      <p className="text-sm text-zinc-500">No votes recorded yet.</p>
    );
  }
  const yesPct = (totalYes / total) * 100;

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h3 className="font-display text-sm font-medium text-zinc-200">
          Vote mix
        </h3>
        <div className="flex gap-4 font-mono text-[11px] text-zinc-500">
          <span>
            <span className="text-emerald-400/90">Yes</span> {totalYes}
          </span>
          <span>
            <span className="text-rose-400/90">No</span> {totalNo}
          </span>
        </div>
      </div>
      <div
        className="flex h-10 w-full overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900"
        role="img"
        aria-label={`Yes ${Math.round(yesPct)} percent, No ${Math.round(
          100 - yesPct
        )} percent`}
      >
        <div
          className="bg-emerald-700/85 transition-[width]"
          style={{ width: `${yesPct}%` }}
        />
        <div
          className="bg-rose-700/85 transition-[width]"
          style={{ width: `${100 - yesPct}%` }}
        />
      </div>
    </div>
  );
}

/** Horizontal bars: clusters ranked by total votes. */
export function ClusterEngagementChart({ rows }: { rows: ClusterRow[] }) {
  const sorted = [...rows].sort((a, b) => b.totalVotes - a.totalVotes);
  const max = Math.max(...sorted.map((r) => r.totalVotes), 1);

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No cluster data yet.</p>
    );
  }

  return (
    <div>
      <h3 className="mb-4 font-display text-sm font-medium text-zinc-200">
        Votes by cluster
      </h3>
      <ul className="space-y-3">
        {sorted.map((row) => {
          const w = (row.totalVotes / max) * 100;
          return (
            <li key={row.clusterId}>
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                <span
                  className="min-w-0 truncate font-mono text-zinc-500"
                  title={row.clusterId}
                >
                  {row.clusterId}
                </span>
                <span className="shrink-0 tabular-nums text-zinc-400">
                  {row.totalVotes}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-sm bg-zinc-800">
                <div
                  className="h-full rounded-sm bg-zinc-400/90"
                  style={{ width: `${w}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function KeyCountBars({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ key: string; count: number }>;
}) {
  const sorted = [...rows].sort((a, b) => b.count - a.count).slice(0, 12);
  const max = Math.max(...sorted.map((r) => r.count), 1);
  if (sorted.length === 0) {
    return <p className="text-sm text-zinc-500">No data yet.</p>;
  }
  return (
    <div>
      <h3 className="mb-4 font-display text-sm font-medium text-zinc-200">
        {title}
      </h3>
      <ul className="space-y-3">
        {sorted.map((row) => (
          <li key={row.key}>
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
              <span className="min-w-0 truncate font-mono text-zinc-500" title={row.key}>
                {row.key}
              </span>
              <span className="shrink-0 tabular-nums text-zinc-400">
                {row.count}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-sm bg-zinc-800">
              <div
                className="h-full rounded-sm bg-zinc-400/90"
                style={{ width: `${(row.count / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Top questions by total votes — bar length ∝ share of max votes. */
export function TopQuestionsVotesChart({
  rows,
  questionHref,
}: {
  rows: QuestionRow[];
  questionHref: (id: number) => string;
}) {
  const sorted = [...rows]
    .filter((r) => r.totalVotes > 0)
    .sort((a, b) => b.totalVotes - a.totalVotes)
    .slice(0, 10);
  const max = Math.max(...sorted.map((r) => r.totalVotes), 1);

  if (sorted.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="mb-4 font-display text-sm font-medium text-zinc-200">
        Most voted questions
      </h3>
      <ul className="space-y-4">
        {sorted.map((row) => {
          const w = (row.totalVotes / max) * 100;
          return (
            <li key={row.id}>
              <Link
                href={questionHref(row.id)}
                className="group block rounded-sm border border-transparent transition hover:border-zinc-700 hover:bg-zinc-900/50"
              >
                <div className="mb-1 flex items-start justify-between gap-3">
                  <span className="line-clamp-2 text-left text-xs leading-snug text-zinc-300 group-hover:text-zinc-100">
                    {row.title}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-500">
                    {row.totalVotes}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-sm bg-zinc-800">
                  <div
                    className="h-full rounded-sm bg-zinc-500/90 transition-[width] group-hover:bg-zinc-400"
                    style={{ width: `${w}%` }}
                  />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Thin yes/no split bar for a single question. */
export function QuestionVoteRatioBar({
  yesRatio,
  noRatio,
}: {
  yesRatio: number;
  noRatio: number;
}) {
  const y = Math.max(0, Math.min(1, yesRatio));
  const n = Math.max(0, Math.min(1, noRatio));
  const sum = y + n || 1;
  const yPct = (y / sum) * 100;

  return (
    <div className="mt-3">
      <div className="mb-1 flex justify-between font-mono text-[10px] text-zinc-500">
        <span className="text-emerald-500/90">{Math.round(y * 100)}% yes</span>
        <span className="text-rose-500/90">{Math.round(n * 100)}% no</span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-sm bg-zinc-800">
        <div
          className="bg-emerald-700/80"
          style={{ width: `${yPct}%` }}
        />
        <div
          className="bg-rose-700/80"
          style={{ width: `${100 - yPct}%` }}
        />
      </div>
    </div>
  );
}
