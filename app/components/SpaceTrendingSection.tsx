"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchSpaceTrending } from "../../lib/spaceApi";

type TrendingQuestion = {
  id: number;
  title: string;
  description?: string;
};

type Metrics = {
  score: number;
  entriesInWindow: number;
  commentsInWindow: number;
  velocityRatio: number;
  risingFast: boolean;
};

type Props = {
  slug: string;
};

export function SpaceTrendingSection({ slug }: Props) {
  const [hot, setHot] = useState<{
    question: TrendingQuestion;
    metrics: Metrics;
  } | null>(null);
  const [emerging, setEmerging] = useState<
    Array<{ question: TrendingQuestion; metrics: Metrics }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setFetchError(false);
        const data = await fetchSpaceTrending(slug);
        if (cancelled) return;
        const h = data.hot;
        if (h?.question && typeof (h.question as TrendingQuestion).id === "number") {
          setHot({
            question: h.question as TrendingQuestion,
            metrics: h.metrics as Metrics,
          });
        } else {
          setHot(null);
        }
        const em = (data.emerging || [])
          .filter(
            (e) => e?.question && typeof (e.question as TrendingQuestion).id === "number"
          )
          .map((e) => ({
            question: e.question as TrendingQuestion,
            metrics: e.metrics as Metrics,
          }));
        setEmerging(em);
        const hasHot =
          h?.question != null &&
          typeof (h.question as TrendingQuestion).id === "number";
        setVisible(hasHot || em.length > 0);
      } catch {
        if (!cancelled) {
          setHot(null);
          setEmerging([]);
          setVisible(false);
          setFetchError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const base = `/s/${encodeURIComponent(slug)}`;

  if (loading) {
    return (
      <div className="mb-10 rounded-lg border border-zinc-800 bg-zinc-900/20 p-6">
        <div className="h-4 w-40 animate-pulse rounded bg-zinc-800" />
        <div className="mt-4 h-24 animate-pulse rounded bg-zinc-800/60" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="mb-10 rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-sm text-zinc-500">
        Trending could not load. Check that the app is on the latest deploy and{" "}
        <code className="rounded bg-zinc-800 px-1 text-[11px] text-zinc-400">
          GET /api/spaces/{slug}/trending
        </code>{" "}
        returns JSON.
      </div>
    );
  }

  if (!visible) {
    return (
      <div className="mb-10 rounded-lg border border-dashed border-zinc-800 bg-zinc-900/20 px-4 py-4 text-sm text-zinc-500">
        <p className="font-medium text-zinc-400">Community trending</p>
        <p className="mt-1 leading-relaxed">
          No topic is surfaced yet — this needs enough recent activity on a question.
          Submit a concern or open a question below; after clustering runs, it may show
          here.
        </p>
        <Link
          href={`${base}/submit`}
          className="mt-3 inline-block text-xs font-medium text-amber-500/90 hover:text-amber-400"
        >
          Share something →
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-10 space-y-8">
      {hot ? (
        <div>
          <h3 className="font-display text-sm font-medium uppercase tracking-[0.14em] text-zinc-500">
            What&apos;s drawing attention
          </h3>
          <Link
            href={`${base}/questions/${hot.question.id}`}
            className="mt-3 block group"
          >
            <article className="rounded-lg border border-amber-900/40 bg-gradient-to-br from-amber-950/30 to-zinc-900/40 p-5 transition hover:border-amber-700/50 hover:from-amber-950/40">
              <p className="text-[10px] font-medium uppercase tracking-wider text-amber-600/90">
                Vote on this now
              </p>
              <h4 className="font-display mt-2 text-lg font-medium leading-snug text-zinc-50 group-hover:text-white sm:text-xl">
                {hot.question.title}
              </h4>
              {hot.question.description ? (
                <p className="mt-2 line-clamp-2 text-sm text-zinc-400">
                  {hot.question.description}
                </p>
              ) : null}
              <p className="mt-4 text-[11px] text-zinc-600">
                {hot.metrics.entriesInWindow} recent inputs
                {hot.metrics.commentsInWindow > 0
                  ? ` · ${hot.metrics.commentsInWindow} discussion notes`
                  : ""}
              </p>
            </article>
          </Link>
        </div>
      ) : null}

      {emerging.length > 0 ? (
        <div>
          <h3 className="font-display text-sm font-medium uppercase tracking-[0.14em] text-zinc-500">
            Also heating up
          </h3>
          <ul className="mt-3 space-y-2">
            {emerging.map((e) => (
              <li key={e.question.id}>
                <Link
                  href={`${base}/questions/${e.question.id}`}
                  className="flex items-start justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-left transition hover:border-zinc-600 hover:bg-zinc-900/50"
                >
                  <span className="text-sm font-medium leading-snug text-zinc-200">
                    {e.question.title}
                  </span>
                  {e.metrics.risingFast ? (
                    <span className="shrink-0 rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-400/90">
                      Rising fast
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
