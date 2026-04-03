"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { use, useEffect, useMemo, useState } from "react";
import { ShareLinkButton } from "../../../components/ShareLinkButton";
import { SITE_URL } from "../../../../lib/siteUrl";
import { spaceFetch } from "../../../../lib/spaceApi";

type Petition = {
  id: number;
  title: string;
  description: string;
  goalSignatures?: number;
  signatureCount?: number;
  createdAt?: number;
};

export default function SpacePetitionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const base = `/s/${encodeURIComponent(slug)}`;

  const [petitions, setPetitions] = useState<Petition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [openId, setOpenId] = useState<number | null>(null);
  const openPetition = useMemo(
    () => petitions.find((p) => p.id === openId) ?? null,
    [openId, petitions]
  );

  const petitionsPageUrl = useMemo(
    () => `${SITE_URL}/s/${encodeURIComponent(slug)}/petitions`,
    [slug]
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [town, setTown] = useState("");
  const [signing, setSigning] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const res = await spaceFetch(slug, "/petitions", { cache: "no-store" });
      const text = await res.text();
      if (!res.ok) throw new Error(text || "Failed to load petitions");
      const data = JSON.parse(text);
      setPetitions(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load petitions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function sign(e: FormEvent) {
    e.preventDefault();
    if (!openPetition) return;
    try {
      setSigning(true);
      setMessage("");
      const res = await spaceFetch(slug, `/petitions/${openPetition.id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          country: country.trim() || undefined,
          town: town.trim() || undefined,
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || "Failed to sign");
      setName("");
      setEmail("");
      setCountry("");
      setTown("");
      setMessage("Signature recorded.");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to sign");
    } finally {
      setSigning(false);
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
              href="/"
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-200"
            >
              Directory
            </Link>
            <Link
              href={base}
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-200"
            >
              Overview
            </Link>
            <Link
              href={`${base}/submit`}
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-200"
            >
              Submit
            </Link>
            <Link
              href={`${base}/petitions`}
              className="rounded-md border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200"
            >
              Petitions
            </Link>
            <Link
              href={`${base}/insights`}
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-200"
            >
              Insights
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-12 lg:px-10">
        <div className="lg:col-span-7">
          <div className="mb-8 border-b border-zinc-800 pb-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Petitions
            </p>
            <p className="mt-1 font-mono text-[11px] text-zinc-600">{slug}</p>
            <div className="mt-6">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Share
              </p>
              <ShareLinkButton url={petitionsPageUrl} />
            </div>
          </div>

          {loading ? (
            <div className="rounded-sm border border-zinc-800 bg-zinc-900/40 p-8 text-sm text-zinc-500">
              Loading…
            </div>
          ) : error ? (
            <div className="rounded-sm border border-red-900/50 bg-red-950/30 p-6 text-sm text-red-200/90">
              {error}
            </div>
          ) : petitions.length === 0 ? (
            <div className="rounded-sm border border-dashed border-zinc-800 bg-zinc-900/20 px-8 py-12 text-center">
              <h2 className="font-display text-lg font-medium text-zinc-200">
                No petitions yet
              </h2>
              <p className="mt-3 text-sm text-zinc-500">
                Hosts can create petitions from Admin. Once published, people can sign here.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {petitions.map((p) => {
                const count = p.signatureCount ?? 0;
                const goal = p.goalSignatures ?? null;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(p.id)}
                      className={`w-full rounded-sm border p-6 text-left transition ${
                        openId === p.id
                          ? "border-zinc-600 bg-zinc-900/50"
                          : "border-zinc-800 bg-zinc-900/25 hover:border-zinc-600"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-mono text-[10px] text-zinc-600">
                            Petition #{p.id}
                          </p>
                          <h3 className="font-display mt-2 text-lg font-medium text-zinc-50">
                            {p.title}
                          </h3>
                          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-zinc-400">
                            {p.description}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-display text-2xl font-medium tabular-nums text-zinc-100">
                            {count}
                          </p>
                          <p className="text-xs text-zinc-500">
                            signatures{goal ? ` · goal ${goal}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="mt-5 h-2 w-full overflow-hidden rounded-sm bg-zinc-800">
                        <div
                          className="h-full bg-zinc-300/90"
                          style={{
                            width: `${Math.min(
                              100,
                              goal ? (count / Math.max(goal, 1)) * 100 : count > 0 ? 18 : 0
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="mt-4 text-xs font-medium text-zinc-500">
                        Click to sign
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside className="lg:col-span-5">
          <div className="rounded-sm border border-zinc-800 bg-zinc-900/25 p-8">
            <h2 className="font-display text-lg font-medium text-zinc-50">
              Sign
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Your signature is recorded for this group. Name and contact are optional.
            </p>

            {!openPetition ? (
              <div className="mt-8 rounded-sm border border-dashed border-zinc-800 bg-zinc-950/50 p-6 text-sm text-zinc-600">
                Choose a petition from the list to sign.
              </div>
            ) : (
              <form onSubmit={sign} className="mt-8 space-y-4">
                <div className="rounded-sm border border-zinc-800 bg-zinc-950/50 p-4">
                  <p className="font-mono text-[10px] text-zinc-600">
                    Petition #{openPetition.id}
                  </p>
                  <p className="mt-1 font-display text-base font-medium text-zinc-100">
                    {openPetition.title}
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Name (optional)
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-sm border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/30"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Email (optional)
                  </label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-sm border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/30"
                    placeholder="you@example.com"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                      Country (optional)
                    </label>
                    <input
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full rounded-sm border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/30"
                      placeholder="e.g. US"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                      Town / city (optional)
                    </label>
                    <input
                      value={town}
                      onChange={(e) => setTown(e.target.value)}
                      className="w-full rounded-sm border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/30"
                      placeholder="e.g. Leeds"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={signing}
                  className="w-full rounded-sm bg-zinc-100 px-6 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {signing ? "Signing…" : "Sign petition"}
                </button>

                {message ? (
                  <div className="rounded-sm border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-300">
                    {message}
                  </div>
                ) : null}
              </form>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

