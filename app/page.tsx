"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_BASE } from "../lib/apiBase";

type Question = {
  id: number;
  title: string;
  description: string;
  argumentsFor: string[];
  argumentsAgainst: string[];
  clusterId: string;
  sourceSubmissionIds: number[];
  votesYes: number;
  votesNo: number;
  createdAt?: number;
};

export default function HomePage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadQuestions() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API_BASE}/questions`, {
          cache: "no-store",
        });

        const text = await res.text();

        if (!res.ok) {
          throw new Error(`Backend returned ${res.status}: ${text}`);
        }

        const data = JSON.parse(text);
        setQuestions(Array.isArray(data) ? data : []);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load questions";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    loadQuestions();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="text-lg font-semibold tracking-tight text-white">
            Agentis
          </div>

          <nav className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Home
            </Link>

            <Link
              href="/submit"
              className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-300 hover:bg-cyan-500/20"
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
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Insights
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10 rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl">
          <div className="mb-4 inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Civic Intelligence Platform
          </div>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Agentis
          </h1>

          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
            Structured civic questions generated from public concerns, clustered
            into clearer signals people can vote on.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-sm text-slate-400">Active Questions</p>
              <p className="mt-2 text-3xl font-semibold">{questions.length}</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-sm text-slate-400">Status</p>
              <p className="mt-2 text-lg font-medium text-emerald-300">
                {loading ? "Loading..." : "Live"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-sm text-slate-400">Source</p>
              <p className="mt-2 text-lg font-medium text-slate-200">
                Clustered questions only
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">
            Active Questions
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Click a question to open it and vote.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-6">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="animate-pulse rounded-3xl border border-slate-800 bg-slate-900/60 p-6"
              >
                <div className="h-6 w-2/3 rounded bg-slate-800" />
                <div className="mt-4 h-4 w-full rounded bg-slate-800" />
                <div className="mt-2 h-4 w-5/6 rounded bg-slate-800" />
              </div>
            ))}
          </div>
        ) : questions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
            <h3 className="text-xl font-semibold text-slate-200">
              No active questions yet
            </h3>
            <p className="mt-3 text-slate-400">
              Submit concerns, then run clustering in Admin to generate questions.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {questions.map((q) => (
              <Link key={q.id} href={`/questions/${q.id}`} className="block">
                <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl transition duration-200 hover:border-slate-700 hover:bg-slate-900">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl">
                      <div className="mb-3 inline-flex rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300">
                        {q.clusterId}
                      </div>

                      <h3 className="text-2xl font-semibold leading-tight text-white">
                        {q.title}
                      </h3>

                      <p className="mt-3 text-slate-300">{q.description}</p>
                    </div>

                    <div className="min-w-[220px] rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <p className="text-sm text-slate-400">Live Votes</p>
                      <div className="mt-3 flex items-center gap-6">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-emerald-300">
                            Yes
                          </p>
                          <p className="text-2xl font-bold text-white">
                            {q.votesYes}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-rose-300">
                            No
                          </p>
                          <p className="text-2xl font-bold text-white">
                            {q.votesNo}
                          </p>
                        </div>
                      </div>

                      <p className="mt-4 text-xs text-slate-500">
                        Source submissions: {q.sourceSubmissionIds.length}
                      </p>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}