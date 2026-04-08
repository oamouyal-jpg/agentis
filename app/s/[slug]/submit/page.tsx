"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { use, useState } from "react";
import { ShareButton } from "../../../components/ShareButton";
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

  async function handleSubmit(e: FormEvent) {
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

      const raw = await res.text();
      let body: { ok?: boolean; error?: string; details?: string } = {};
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        body = {};
      }

      if (!res.ok) {
        const hint =
          res.status === 404
            ? " API not found — check that the app URL uses /api (set NEXT_PUBLIC_API_BASE_URL to https://…/api or leave unset)."
            : "";
        throw new Error(
          (body.error || body.details || raw || `HTTP ${res.status}`) + hint
        );
      }

      setText("");
      setMessage("Submission sent successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submit failed";
      setMessage(
        msg.length > 280
          ? `${msg.slice(0, 280)}…`
          : `There was a problem submitting your concern. ${msg}`
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-10">
          <Link
            href="/"
            className="font-display text-base font-medium tracking-tight text-zinc-100"
          >
            Agentis
          </Link>
          <nav className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:text-xs">
            <Link href={base} className="font-medium text-zinc-400 transition hover:text-zinc-100">Back to group</Link>
            <ShareButton text="Share your concern on Agentis" />
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-12 lg:px-10">
        <div className="mb-8 border-b border-zinc-800 pb-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Submit
          </p>
          <p className="mt-1 font-mono text-[11px] text-zinc-600">{slug}</p>
        </div>

        <div className="rounded-sm border border-zinc-800 bg-zinc-900/25 p-8 lg:p-10">
          <h1 className="font-display text-3xl font-medium tracking-tight text-zinc-50 sm:text-[2rem]">
            Submit a concern
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400">
            This goes to the <span className="text-zinc-300">{slug}</span> group.
            Similar concerns are clustered automatically into vote-ready questions.
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
                placeholder="Describe a real issue affecting people or policy you care about."
                className="w-full rounded-sm border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/30"
              />
            </div>

            <div className="flex flex-col gap-4 border-t border-zinc-800/80 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-zinc-500">
                Clear, specific wording helps clustering match your concern to the
                right issue.
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
