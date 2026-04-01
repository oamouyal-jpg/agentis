"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-white">
            Agentis
          </Link>

          <nav className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Home
            </Link>
            <Link
              href="/submit"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Submit
            </Link>
            <Link
              href="/admin"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Admin
            </Link>
            <Link
              href="/insights"
              className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-300"
            >
              Insights
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10 rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl">
          <div className="mb-4 inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Insight Engine
          </div>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Insights
          </h1>

          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
            Live interpretation of voting behaviour across active civic questions.
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
            <StatCard
              label="Yes votes"
              value={data?.overview.totalYes ?? 0}
            />
            <StatCard
              label="No votes"
              value={data?.overview.totalNo ?? 0}
            />
          </div>
        </div>

        {loading && (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8">
            Loading insights...
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-8">
            <InsightSection
              title="Top Questions"
              subtitle="Questions receiving the most total votes."
              items={data.topQuestions}
              renderItem={(item) => (
                <QuestionInsightCard
                  key={item.id}
                  title={item.title}
                  description={item.description}
                  clusterId={item.clusterId}
                  totalVotes={item.totalVotes}
                  yesLabel={`${Math.round(item.yesRatio * 100)}% yes`}
                  noLabel={`${Math.round(item.noRatio * 100)}% no`}
                  href={`/questions/${item.id}`}
                />
              )}
            />

            <InsightSection
              title="Most Controversial"
              subtitle="Questions with the closest split between yes and no."
              items={data.mostControversial}
              renderItem={(item) => (
                <QuestionInsightCard
                  key={item.id}
                  title={item.title}
                  description={item.description}
                  clusterId={item.clusterId}
                  totalVotes={item.totalVotes}
                  yesLabel={`${Math.round(item.yesRatio * 100)}% yes`}
                  noLabel={`${Math.round(item.noRatio * 100)}% no`}
                  extraLabel={`controversy ${Math.round(item.controversyScore * 100)}%`}
                  href={`/questions/${item.id}`}
                />
              )}
            />

            <InsightSection
              title="Strongest Consensus"
              subtitle="Questions showing the clearest agreement."
              items={data.strongestConsensus}
              renderItem={(item) => (
                <QuestionInsightCard
                  key={item.id}
                  title={item.title}
                  description={item.description}
                  clusterId={item.clusterId}
                  totalVotes={item.totalVotes}
                  yesLabel={`${Math.round(item.yesRatio * 100)}% yes`}
                  noLabel={`${Math.round(item.noRatio * 100)}% no`}
                  extraLabel={`${item.consensusSide.toUpperCase()} consensus ${Math.round(
                    item.consensusStrength * 100
                  )}%`}
                  href={`/questions/${item.id}`}
                />
              )}
            />

            <InsightSection
              title="Cluster Summary"
              subtitle="Which issue clusters are drawing the most engagement."
              items={data.clusterSummary}
              renderItem={(item) => (
                <article
                  key={item.clusterId}
                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
                >
                  <div className="mb-3 inline-flex rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300">
                    {item.clusterId}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-slate-400">Questions in cluster</p>
                      <p className="mt-1 text-2xl font-semibold text-white">
                        {item.questionCount}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-400">Total votes</p>
                      <p className="mt-1 text-2xl font-semibold text-white">
                        {item.totalVotes}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="mb-2 text-sm font-medium text-slate-300">
                      Titles in this cluster
                    </p>
                    <ul className="space-y-2 text-sm text-slate-400">
                      {item.titles.map((title, index) => (
                        <li key={`${item.clusterId}-${index}`}>• {title}</li>
                      ))}
                    </ul>
                  </div>
                </article>
              )}
            />
          </div>
        )}

        {!loading && !error && data && data.overview.totalQuestions === 0 && (
          <div className="mt-8 rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
            <h2 className="text-xl font-semibold text-slate-200">
              No insights yet
            </h2>
            <p className="mt-3 text-slate-400">
              Submit concerns, run clustering, and collect votes to generate insights.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}

function InsightSection({
  title,
  subtitle,
  items = [],
  renderItem,
}: {
  title: string;
  subtitle: string;
  items?: any[];
  renderItem: (item: any, index: number) => React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>

      {!items || items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 p-6 text-sm text-slate-500">
          No insight items yet.
        </div>
      ) : (
        <div className="grid gap-4">{items.map(renderItem)}</div>
      )}
    </section>
  );
}

function QuestionInsightCard({
  title,
  description,
  clusterId,
  totalVotes,
  yesLabel,
  noLabel,
  extraLabel,
  href,
}: {
  title: string;
  description: string;
  clusterId: string;
  totalVotes: number;
  yesLabel: string;
  noLabel: string;
  extraLabel?: string;
  href: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
      <div className="mb-3 inline-flex rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300">
        {clusterId}
      </div>

      <h3 className="text-xl font-semibold text-white">{title}</h3>
      <p className="mt-2 text-slate-300">{description}</p>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">
          {totalVotes} total votes
        </span>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300">
          {yesLabel}
        </span>
        <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-rose-300">
          {noLabel}
        </span>
        {extraLabel && (
          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-cyan-300">
            {extraLabel}
          </span>
        )}
      </div>

      <div className="mt-5">
        <Link
          href={href}
          className="inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          Open question
        </Link>
      </div>
    </article>
  );
}