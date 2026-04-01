"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_BASE } from "../lib/apiBase";

type SpaceListItem = {
  id: number;
  name: string;
  slug: string;
  description: string;
  visibility: "public" | "members_only";
  membersOnly: boolean;
};

export default function SpacesDirectoryPage() {
  const [spaces, setSpaces] = useState<SpaceListItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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

  async function handleCreate(e: React.FormEvent) {
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
          ? `Space created. Save this invite link token: ${data.inviteSecret} (shown once). Share: /s/${data.space.slug}?invite=${encodeURIComponent(data.inviteSecret)}`
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
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="text-lg font-semibold tracking-tight text-white">
            Agentis
          </div>
          <p className="text-sm text-slate-500">Spaces</p>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10 rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Choose a space
          </h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            Each space has its own submissions, clustered questions, and votes.
            The public <strong className="text-slate-200">open</strong> space is
            the default; create a members-only space for a closed group (invite
            link).
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-slate-400">Loading spaces...</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {spaces.map((s) => (
              <Link
                key={s.id}
                href={`/s/${encodeURIComponent(s.slug)}`}
                className="block rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition hover:border-cyan-500/40 hover:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-white">{s.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">/{s.slug}</p>
                  </div>
                  {s.membersOnly && (
                    <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
                      Members
                    </span>
                  )}
                </div>
                {s.description ? (
                  <p className="mt-3 text-sm text-slate-400">{s.description}</p>
                ) : null}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-14 rounded-3xl border border-slate-800 bg-slate-900/50 p-8">
          <h2 className="text-xl font-semibold text-white">Create a space</h2>
          <p className="mt-2 text-sm text-slate-400">
            Slug becomes the URL: <code className="text-cyan-300">/s/your-slug</code>
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
              <label className="mb-1 block text-sm text-slate-300">Visibility</label>
              <select
                value={visibility}
                onChange={(e) =>
                  setVisibility(e.target.value as "public" | "members_only")
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-slate-100"
              >
                <option value="public">Public — anyone can submit and vote</option>
                <option value="members_only">
                  Members only — need invite token
                </option>
              </select>
            </div>
            <button
              type="submit"
              disabled={creating}
              className="rounded-xl bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
            >
              {creating ? "Creating..." : "Create space"}
            </button>
          </form>
          {createMsg && (
            <p className="mt-4 whitespace-pre-wrap text-sm text-slate-300">
              {createMsg}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
