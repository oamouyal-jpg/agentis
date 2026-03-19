"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";

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

const API_BASE = "http://localhost:4000";

export default function QuestionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const questionId = Number(id);

  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [existingVote, setExistingVote] = useState<"yes" | "no" | null>(null);

  const storageKey = useMemo(() => `agentis-vote-${questionId}`, [questionId]);

  useEffect(() => {
    try {
      const savedVote = window.localStorage.getItem(storageKey);
      if (savedVote === "yes" || savedVote === "no") {
        setExistingVote(savedVote);
      }
    } catch {
      // ignore localStorage issues
    }
  }, [storageKey]);

  useEffect(() => {
    async function loadQuestion() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API_BASE}/questions`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to load questions");
        }

        const data: Question[] = await res.json();
        const found = data.find((q) => q.id === questionId) || null;

        if (!found) {
          throw new Error("Question not found");
        }

        setQuestion(found);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }

    if (!Number.isNaN(questionId)) {
      loadQuestion();
    } else {
      setError("Invalid question id");
      setLoading(false);
    }
  }, [questionId]);

  async function handleVote(vote: "yes" | "no") {
    if (!question || existingVote || submittingVote) return;

    try {
      setSubmittingVote(true);
      setMessage("");
      setError("");

      const res = await fetch(`${API_BASE}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionId: question.id,
          vote,
        }),
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || "Failed to vote");
      }

      const data = JSON.parse(text);

      if (data?.question) {
        setQuestion(data.question);
      }

      setExistingVote(vote);

      try {
        window.localStorage.setItem(storageKey, vote);
      } catch {
        // ignore localStorage issues
      }

      setMessage(`Your ${vote.toUpperCase()} vote was recorded.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Voting failed");
    } finally {
      setSubmittingVote(false);
    }
  }

  const totalVotes = (question?.votesYes || 0) + (question?.votesNo || 0);
  const yesPercent =
    totalVotes > 0 && question ? Math.round((question.votesYes / totalVotes) * 100) : 0;
  const noPercent =
    totalVotes > 0 && question ? Math.round((question.votesNo / totalVotes) * 100) : 0;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
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
              href="/insights"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Insights
            </Link>
            <Link
              href="/admin"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Admin
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <Link
          href="/"
          className="mb-6 inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          ← Back to questions
        </Link>

        {loading && (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8">
            Loading question...
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && question && (
          <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl">
            <div className="mb-4 inline-flex rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300">
              {question.clusterId}
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {question.title}
            </h1>

            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
              {question.description}
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-sm text-slate-400">Yes votes</p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {question.votesYes}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-sm text-slate-400">No votes</p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {question.votesNo}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-sm text-slate-400">Total votes</p>
                <p className="mt-2 text-3xl font-semibold text-white">{totalVotes}</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-sm text-slate-400">Your vote</p>
                <p className="mt-2 text-lg font-semibold text-cyan-300">
                  {existingVote ? existingVote.toUpperCase() : "Not voted"}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="mb-3 flex items-center justify-between text-sm text-slate-400">
                <span>Vote split</span>
                <span>
                  Yes {yesPercent}% · No {noPercent}%
                </span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${yesPercent}%` }}
                />
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => handleVote("yes")}
                disabled={submittingVote || !!existingVote}
                className={`rounded-2xl px-6 py-3 text-sm font-semibold transition ${
                  existingVote === "yes"
                    ? "bg-emerald-400 text-slate-950"
                    : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {submittingVote
                  ? "Submitting..."
                  : existingVote === "yes"
                  ? "You voted Yes"
                  : "Vote Yes"}
              </button>

              <button
                type="button"
                onClick={() => handleVote("no")}
                disabled={submittingVote || !!existingVote}
                className={`rounded-2xl px-6 py-3 text-sm font-semibold transition ${
                  existingVote === "no"
                    ? "bg-rose-400 text-white"
                    : "bg-rose-500 text-white hover:bg-rose-400"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {submittingVote
                  ? "Submitting..."
                  : existingVote === "no"
                  ? "You voted No"
                  : "Vote No"}
              </button>
            </div>

            {message && (
              <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                {message}
              </div>
            )}

            {!!existingVote && (
              <div className="mt-4 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-cyan-200">
                You have already voted on this question from this browser.
              </div>
            )}

            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-300">
                  Arguments For
                </h2>
                <ul className="space-y-3 text-sm leading-6 text-slate-200">
                  {question.argumentsFor.map((argument, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                      <span>{argument}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-rose-300">
                  Arguments Against
                </h2>
                <ul className="space-y-3 text-sm leading-6 text-slate-200">
                  {question.argumentsAgainst.map((argument, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-rose-400" />
                      <span>{argument}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        )}
      </section>
    </main>
  );
}