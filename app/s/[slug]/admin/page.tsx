"use client";

import Link from "next/link";
import { use, useState } from "react";
import { spaceFetch } from "../../../../lib/spaceApi";

export default function SpaceAdminPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const base = `/s/${encodeURIComponent(slug)}`;

  async function runClustering() {
    try {
      setLoading(true);
      setMessage("");

      const res = await spaceFetch(slug, "/admin/cluster", {
        method: "POST",
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || "Clustering failed");
      }

      const data = JSON.parse(text);

      setMessage(
        `Clusters created: ${data.clustersCreated}, Questions created: ${data.questionsCreated}`
      );
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold text-white">
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
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Submit
            </Link>
            <Link
              href={`${base}/admin`}
              className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-300"
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
          <div className="mb-4 inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-300">
            Space admin
          </div>

          <h1 className="text-3xl font-bold text-white">Admin — {slug}</h1>

          <p className="mt-3 text-slate-300">
            Cluster pending submissions in this space into structured questions.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-400">
              Uses AI to group concerns and generate yes/no questions.
            </p>

            <button
              onClick={runClustering}
              disabled={loading}
              className="rounded-2xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
            >
              {loading ? "Running..." : "Run Clustering"}
            </button>
          </div>

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
