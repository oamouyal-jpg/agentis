"use client";

import Link from "next/link";

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* NAV */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold text-white">
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
              className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-300"
            >
              Admin
            </Link>
          </nav>
        </div>
      </header>

      {/* CONTENT */}
      <section className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl">
          <div className="mb-4 inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-300">
            System
          </div>

          <h1 className="text-3xl font-bold text-white">
            Admin
          </h1>

          <p className="mt-3 text-slate-300">
            Clustering runs automatically in the background whenever someone submits
            a concern on the open space. Raw submissions are merged into existing
            issues or grouped into new vote-ready questions using AI — no manual step.
          </p>

          <p className="mt-4 text-sm text-slate-500">
            Per-group hosts manage artwork and settings from each group’s admin page
            under <code className="text-slate-400">/s/&lt;slug&gt;/admin</code>.
          </p>
        </div>
      </section>
    </main>
  );
}
