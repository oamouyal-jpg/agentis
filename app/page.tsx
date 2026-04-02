"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../lib/apiBase";

type SpaceListItem = {
  id: number;
  name: string;
  slug: string;
  description: string;
  visibility: "public" | "members_only";
  membersOnly: boolean;
};

export default function HomePage() {
  const [spaces, setSpaces] = useState<SpaceListItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [openQuestionCount, setOpenQuestionCount] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "members_only">("public");
  const [createMsg, setCreateMsg] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`${API_BASE}/spaces`, { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setSpaces(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load spaces");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    async function loadOpenStats() {
      try {
        const res = await fetch(`${API_BASE}/spaces/open/questions`, {
          cache: "no-store",
        });
        if (!res.ok) {
          setOpenQuestionCount(null);
          return;
        }
        const data = await res.json();
        setOpenQuestionCount(Array.isArray(data) ? data.length : 0);
      } catch {
        setOpenQuestionCount(null);
      }
    }
    loadOpenStats();
  }, []);

  const { publicSpaces, membersSpaces } = useMemo(() => {
    const pub: SpaceListItem[] = [];
    const mem: SpaceListItem[] = [];
    for (const s of spaces) {
      if (s.membersOnly || s.visibility === "members_only") mem.push(s);
      else pub.push(s);
    }
    return { publicSpaces: pub, membersSpaces: mem };
  }, [spaces]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateMsg("");
    if (!name.trim() || !slug.trim()) {
      setCreateMsg("Name and slug are required.");
      return;
    }
    try {
      setCreating(true);
      const res = await fetch(`${API_BASE}/spaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim(),
          visibility,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Create failed");
      }
      setCreateMsg(
        data.inviteSecret
          ? `Space created. Save this invite token (shown once): ${data.inviteSecret}\nShare: /s/${data.space.slug}?invite=${encodeURIComponent(data.inviteSecret)}`
          : "Space created."
      );
      setName("");
      setSlug("");
      setDescription("");
      const listRes = await fetch(`${API_BASE}/spaces`, { cache: "no-store" });
      if (listRes.ok) {
        setSpaces(await listRes.json());
      }
    } catch (e) {
      setCreateMsg(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="text-lg font-semibold tracking-tight text-white">
            Agentis
          </div>
          <nav className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Link
              href="/s/open"
              className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-300 hover:bg-cyan-500/20"
            >
              Public feed
            </Link>
            <Link
              href="/s/open/submit"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Submit
            </Link>
            <Link
              href="/s/open/insights"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Insights
            </Link>
            <Link
              href="/s/open/admin"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Admin
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-12 rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl sm:p-10">
          <div className="mb-4 inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Civic Intelligence Platform
          </div>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Agentis
          </h1>

          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
            Turn raw concerns from the crowd into clustered questions, clear
            yes/no votes, and live insights — so signal rises above noise for
            communities, creators, and organisations.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/s/open"
              className="inline-flex rounded-2xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Go to public space
            </Link>
            <Link
              href="/s/open/submit"
              className="inline-flex rounded-2xl border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800"
            >
              Submit a concern
            </Link>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-sm text-slate-400">Public questions</p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {openQuestionCount === null ? "—" : openQuestionCount}
              </p>
              <p className="mt-1 text-xs text-slate-500">in the open feed</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-sm text-slate-400">Spaces</p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {loading ? "—" : spaces.length}
              </p>
              <p className="mt-1 text-xs text-slate-500">public + members-only</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-sm text-slate-400">Status</p>
              <p className="mt-2 text-lg font-medium text-emerald-300">
                {loading ? "Loading…" : "Live"}
              </p>
              <p className="mt-1 text-xs text-slate-500">Crowd-sourced issues</p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Choose a space
          </h2>
          <p className="mt-2 max-w-3xl text-slate-400">
            <span className="text-slate-300">Public</span> spaces — anyone can
            submit and vote.{" "}
            <span className="text-slate-300">Members-only</span> spaces — use an
            invite link from the host.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-10">
            {publicSpaces.length > 0 && (
              <div>
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-emerald-400/90">
                  Public spaces
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {publicSpaces.map((s) => (
                    <Link
                      key={s.id}
                      href={`/s/${encodeURIComponent(s.slug)}`}
                      className="block rounded-2xl border border-emerald-500/20 bg-slate-900/60 p-6 transition hover:border-emerald-500/50 hover:bg-slate-900"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-xl font-semibold text-white">
                            {s.name}
                          </h2>
                          <p className="mt-1 font-mono text-sm text-slate-500">
                            /s/{s.slug}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                          Public
                        </span>
                      </div>
                      {s.description ? (
                        <p className="mt-3 text-sm leading-relaxed text-slate-400">
                          {s.description}
                        </p>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {membersSpaces.length > 0 && (
              <div>
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-amber-400/90">
                  Members-only spaces
                </h3>
                <p className="mb-4 text-sm text-slate-500">
                  You need an invite link with a token. Open the link shared by
                  the host, then browse and vote as usual.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {membersSpaces.map((s) => (
                    <Link
                      key={s.id}
                      href={`/s/${encodeURIComponent(s.slug)}`}
                      className="block rounded-2xl border border-amber-500/20 bg-slate-900/60 p-6 transition hover:border-amber-500/50 hover:bg-slate-900"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-xl font-semibold text-white">
                            {s.name}
                          </h2>
                          <p className="mt-1 font-mono text-sm text-slate-500">
                            /s/{s.slug}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-200">
                          Private
                        </span>
                      </div>
                      {s.description ? (
                        <p className="mt-3 text-sm leading-relaxed text-slate-400">
                          {s.description}
                        </p>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {!loading && spaces.length === 0 && (
              <p className="text-slate-500">No spaces yet. Create one below.</p>
            )}
          </div>
        )}

        <details className="mt-14 rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
          <summary className="cursor-pointer text-lg font-semibold text-white">
            Create a new space
          </summary>
          <p className="mt-2 text-sm text-slate-400">
            For a channel, org, or campaign. Slug becomes{" "}
            <code className="text-cyan-300">/s/your-slug</code>.
          </p>
          <form onSubmit={handleCreate} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm text-slate-300">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-slate-100"
                placeholder="e.g. Creator community"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Slug</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-slate-100"
                placeholder="e.g. my-channel"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">
                Description (optional)
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">
                Visibility
              </label>
              <select
                value={visibility}
                onChange={(e) =>
                  setVisibility(e.target.value as "public" | "members_only")
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-slate-100"
              >
                <option value="public">Public — anyone can submit and vote</option>
                <option value="members_only">
                  Members only — invite token required
                </option>
              </select>
            </div>
            <button
              type="submit"
              disabled={creating}
              className="rounded-xl bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
            >
              {creating ? "Creating…" : "Create space"}
            </button>
          </form>
          {createMsg && (
            <p className="mt-4 whitespace-pre-wrap text-sm text-slate-300">
              {createMsg}
            </p>
          )}
        </details>
      </section>
    </main>
  );
}
