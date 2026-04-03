"use client";

import Link from "next/link";
import { useState } from "react";
import { API_BASE } from "../../lib/apiBase";

export default function SubmitPage() {
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!text.trim()) {
      setMessage("Please enter a submission.");
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");

      const res = await fetch(`${API_BASE}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: text.trim() }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit");
      }

      setText("");
      setMessage("Submission sent successfully.");
    } catch (_err) {
      setMessage("There was a problem submitting your concern.");
    } finally {
      setSubmitting(false);
    }
  }

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
              className="rounded-md border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200"
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
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-200"
            >
              Insights
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-12 lg:px-10">
        <div className="mb-8 border-b border-zinc-800 pb-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Open space
          </p>
          <p className="mt-1 font-mono text-[11px] text-zinc-600">default civic desk</p>
        </div>

        <div className="rounded-sm border border-zinc-800 bg-zinc-900/25 p-8 lg:p-10">
          <h1 className="font-display text-3xl font-medium tracking-tight text-zinc-50 sm:text-[2rem]">
            Submit a public concern
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Describe an issue affecting daily life, community wellbeing, or public
            priorities. Similar submissions are clustered automatically into
            structured questions for voting.
          </p>

          <form onSubmit={handleSubmit} className="mt-10 space-y-6">
            <div>
              <label
                htmlFor="submission"
                className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-zinc-500"
              >
                Your concern
              </label>

              <textarea
                id="submission"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                placeholder="Example: Rent in my area is rising too fast and ordinary workers can no longer afford to live near where they work."
                className="w-full rounded-sm border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/30"
              />
            </div>

            <div className="flex flex-col gap-4 border-t border-zinc-800/80 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-zinc-500">
                Clear, specific wording produces stronger questions and insights.
              </p>

              <button
                type="submit"
                disabled={submitting}
                className="rounded-sm bg-zinc-100 px-6 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit concern"}
              </button>
            </div>
          </form>

          {message && (
            <div className="mt-8 rounded-sm border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-300">
              {message}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
