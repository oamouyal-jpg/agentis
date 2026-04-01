"use client";

import Link from "next/link";
import { use, useState } from "react";
import { spaceFetch } from "../../../../lib/spaceApi";

export default function SpaceSubmitPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const base = `/s/${encodeURIComponent(slug)}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!text.trim()) {
      setMessage("Please enter a submission.");
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");

      const res = await spaceFetch(slug, "/submit", {
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
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-white">
            Agentis
          </Link>

          <nav className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Spaces
            </Link>
            <Link
              href={base}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Home
            </Link>
            <Link
              href={`${base}/submit`}
              className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-300"
            >
              Submit
            </Link>
            <Link
              href={`${base}/admin`}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Admin
            </Link>
            <Link
              href={`${base}/insights`}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Insights
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl">
          <div className="mb-4 inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Public Signal Input
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Submit a concern
          </h1>

          <p className="mt-4 text-base leading-7 text-slate-300">
            This goes to the <strong className="text-slate-200">{slug}</strong>{" "}
            space. Similar submissions are clustered into vote-ready questions.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="submission"
                className="mb-3 block text-sm font-medium text-slate-200"
              >
                Your concern
              </label>

              <textarea
                id="submission"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                placeholder="Describe a real issue affecting people or policy you care about."
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-4 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-400">
                Clear, specific submissions produce better clustering.
              </p>

              <button
                type="submit"
                disabled={submitting}
                className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Submit concern"}
              </button>
            </div>
          </form>

          {message && (
            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200">
              {message}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
