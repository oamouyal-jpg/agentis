"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  ClusterEngagementChart,
  KeyCountBars,
  OverviewVoteSplitChart,
  TopQuestionsVotesChart,
} from "../components/insights/InsightCharts";
import { MindChangesPanel } from "../components/insights/MindChangesPanel";
import { InsightQuestionCard } from "../components/insights/InsightQuestionCard";
import { API_BASE } from "../../lib/apiBase";

type InsightQuestion = {
  id: number;
  title: string;
  description: string;
  argumentsFor: string[];
  argumentsAgainst: string[];
  clusterId: string;
  sourceSubmissionIds: number[];
  votesYes: number;
  votesNo: number;
  totalVotes: number;
  yesRatio: number;
  noRatio: number;
  controversyScore: number;
};

type ConsensusQuestion = InsightQuestion & {
  consensusSide: "yes" | "no";
  consensusStrength: number;
};

type ClusterSummary = {
  clusterId: string;
  questionCount: number;
  totalVotes: number;
  titles: string[];
};

type InsightsResponse = {
  ok: boolean;
  overview: {
    totalQuestions: number;
    totalVotes: number;
    totalYes: number;
    totalNo: number;
  };
  topQuestions: InsightQuestion[];
  mostControversial: InsightQuestion[];
  strongestConsensus: ConsensusQuestion[];
  clusterSummary: ClusterSummary[];
  demographics?: {
    gender: Array<{ key: string; count: number }>;
    ageRange: Array<{ key: string; count: number }>;
    country: Array<{ key: string; count: number }>;
    town: Array<{ key: string; count: number }>;
    totalEvents: number;
  };
  mindChanges: {
    total: number;
    yesToNo: number;
    noToYes: number;
    shareOfVoters: number;
    medianMsToFlip: number | null;
    medianTimeLabel: string | null;
    topQuestions: Array<{ questionId: number; title: string; flipCount: number }>;
  };
};

export default function InsightsPage() {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadInsights() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API_BASE}/insights`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to load insights");
        }

        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }

    loadInsights();
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4 lg:px-10">
          <Link
            href="/"
            className="font-display text-lg font-medium tracking-tight text-zinc-100"
          >
            Agentis
          </Link>

          <nav className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-200"
            >
              Home
            </Link>
            <Link
              href="/submit"
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-200"
            >
              Submit
            </Link>
            <Link
              href="/admin"
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-200"
            >
              Admin
            </Link>
            <Link
              href="/insights"
              className="rounded-md border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200"
            >
              Insights
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12 lg:px-10">
        <div className="mb-10 border-b border-zinc-800 pb-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Open space
          </p>
          <h1 className="font-display mt-2 text-3xl font-medium tracking-tight text-zinc-50 sm:text-4xl">
            Insights
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Live voting signal across the default civic space.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-4">
            <StatCard
              label="Questions"
              value={data?.overview.totalQuestions ?? 0}
            />
            <StatCard
              label="Total votes"
              value={data?.overview.totalVotes ?? 0}
            />
            <StatCard label="Yes" value={data?.overview.totalYes ?? 0} />
            <StatCard label="No" value={data?.overview.totalNo ?? 0} />
          </div>
        </div>

        {loading && (
          <div className="rounded-sm border border-zinc-800 bg-zinc-900/40 p-8 text-sm text-zinc-500">
            Loading insights…
          </div>
        )}

        {error && (
          <div className="rounded-sm border border-red-500/30 bg-red-950/40 p-6 text-sm text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && data && data.overview.totalQuestions > 0 && (
          <div className="mb-10 space-y-8">
            {data.mindChanges ? (
              <MindChangesPanel
                mindChanges={data.mindChanges}
                questionHref={(id) => `/questions/${id}`}
              />
            ) : null}
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="rounded-sm border border-zinc-800 bg-zinc-900/25 p-8">
                <OverviewVoteSplitChart
                  totalYes={data.overview.totalYes}
                  totalNo={data.overview.totalNo}
                />
              </div>
              <div className="rounded-sm border border-zinc-800 bg-zinc-900/25 p-8">
                <ClusterEngagementChart
                  rows={data.clusterSummary.map((c) => ({
                    clusterId: c.clusterId,
                    totalVotes: c.totalVotes,
                  }))}
                />
              </div>
            </div>

            <div className="rounded-sm border border-zinc-800 bg-zinc-900/25 p-8">
              <TopQuestionsVotesChart
                rows={data.topQuestions.map((q) => ({
                  id: q.id,
                  title: q.title,
                  totalVotes: q.totalVotes,
                }))}
                questionHref={(id) => `/questions/${id}`}
              />
            </div>

            {data.demographics && data.demographics.totalEvents > 0 ? (
              <div className="grid gap-8 lg:grid-cols-2">
                <div className="rounded-sm border border-zinc-800 bg-zinc-900/25 p-8">
                  <KeyCountBars title="Gender" rows={data.demographics.gender} />
                </div>
                <div className="rounded-sm border border-zinc-800 bg-zinc-900/25 p-8">
                  <KeyCountBars title="Age range" rows={data.demographics.ageRange} />
                </div>
                <div className="rounded-sm border border-zinc-800 bg-zinc-900/25 p-8">
                  <KeyCountBars title="Country" rows={data.demographics.country} />
                </div>
                <div className="rounded-sm border border-zinc-800 bg-zinc-900/25 p-8">
                  <KeyCountBars title="Town / city" rows={data.demographics.town} />
                </div>
              </div>
            ) : null}
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-8">
            <InsightSection
              title="Top questions"
              subtitle="Highest turnout."
              items={data.topQuestions}
              renderItem={(item) => (
                <InsightQuestionCard
                  key={item.id}
                  title={item.title}
                  description={item.description}
                  clusterId={item.clusterId}
                  totalVotes={item.totalVotes}
                  yesRatio={item.yesRatio}
                  noRatio={item.noRatio}
                  href={`/questions/${item.id}`}
                />
              )}
            />

            <InsightSection
              title="Most controversial"
              subtitle="Closest yes / no split."
              items={data.mostControversial}
              renderItem={(item) => (
                <InsightQuestionCard
                  key={item.id}
                  title={item.title}
                  description={item.description}
                  clusterId={item.clusterId}
                  totalVotes={item.totalVotes}
                  yesRatio={item.yesRatio}
                  noRatio={item.noRatio}
                  extraLabel={`Controversy ${Math.round(item.controversyScore * 100)}%`}
                  href={`/questions/${item.id}`}
                />
              )}
            />

            <InsightSection
              title="Strongest consensus"
              subtitle="Clearest agreement."
              items={data.strongestConsensus}
              renderItem={(item) => (
                <InsightQuestionCard
                  key={item.id}
                  title={item.title}
                  description={item.description}
                  clusterId={item.clusterId}
                  totalVotes={item.totalVotes}
                  yesRatio={item.yesRatio}
                  noRatio={item.noRatio}
                  extraLabel={`${item.consensusSide.toUpperCase()} · ${Math.round(
                    item.consensusStrength * 100
                  )}%`}
                  href={`/questions/${item.id}`}
                />
              )}
            />

            <InsightSection
              title="Clusters"
              subtitle="Engagement and titles per theme."
              items={data.clusterSummary}
              renderItem={(item: ClusterSummary) => (
                <article
                  key={item.clusterId}
                  className="rounded-sm border border-zinc-800 bg-zinc-950/50 p-5"
                >
                  <div className="mb-3 inline-flex rounded-sm border border-zinc-700 bg-zinc-900/80 px-2 py-0.5 font-mono text-[10px] text-zinc-500">
                    {item.clusterId}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-zinc-500">Questions</p>
                      <p className="mt-1 font-display text-xl font-medium tabular-nums text-zinc-100">
                        {item.questionCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Votes</p>
                      <p className="mt-1 font-display text-xl font-medium tabular-nums text-zinc-100">
                        {item.totalVotes}
                      </p>
                    </div>
                  </div>

                  <ul className="mt-4 space-y-1.5 border-t border-zinc-800/80 pt-4 text-xs text-zinc-500">
                    {item.titles.map((title: string, index: number) => (
                      <li key={`${item.clusterId}-${index}`}>— {title}</li>
                    ))}
                  </ul>
                </article>
              )}
            />
          </div>
        )}

        {!loading && !error && data && data.overview.totalQuestions === 0 && (
          <div className="mt-8 rounded-sm border border-dashed border-zinc-800 bg-zinc-900/30 px-8 py-12 text-center">
            <h2 className="font-display text-lg font-medium text-zinc-200">
              No insights yet
            </h2>
            <p className="mt-3 text-sm text-zinc-500">
              Submit concerns — clustering runs automatically — then collect votes
              to see charts here.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-sm border border-zinc-800 bg-zinc-900/40 p-4">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-2 font-display text-2xl font-medium tabular-nums text-zinc-50">
        {value}
      </p>
    </div>
  );
}

function InsightSection<T>({
  title,
  subtitle,
  items = [],
  renderItem,
}: {
  title: string;
  subtitle: string;
  items?: T[];
  renderItem: (item: T, index: number) => ReactNode;
}) {
  return (
    <section className="rounded-sm border border-zinc-800 bg-zinc-900/20 p-6">
      <div className="mb-6">
        <h2 className="font-display text-xl font-medium text-zinc-100">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      </div>

      {!items || items.length === 0 ? (
        <div className="rounded-sm border border-dashed border-zinc-800 bg-zinc-950/50 p-6 text-sm text-zinc-600">
          No items yet.
        </div>
      ) : (
        <div className="grid gap-4">{items.map(renderItem)}</div>
      )}
    </section>
  );
}
