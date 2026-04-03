"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { spaceFetch } from "../../../../lib/spaceApi";
import { API_BASE } from "../../../../lib/apiBase";

type Question = {
  id: number;
  title: string;
  imageUrl?: string;
  yesMeans?: string;
  noMeans?: string;
};

type Petition = {
  id: number;
  title: string;
  description: string;
  goalSignatures?: number;
  signatureCount?: number;
};

export default function SpaceAdminPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [message, setMessage] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [clarifierDrafts, setClarifierDrafts] = useState<
    Record<number, { yes: string; no: string }>
  >({});
  const [savingClarifierId, setSavingClarifierId] = useState<number | null>(null);
  const [petitions, setPetitions] = useState<Petition[]>([]);
  const [loadingPetitions, setLoadingPetitions] = useState(true);
  const [creatingPetition, setCreatingPetition] = useState(false);
  const [petitionTitle, setPetitionTitle] = useState("");
  const [petitionDesc, setPetitionDesc] = useState("");
  const [petitionGoal, setPetitionGoal] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [accentColor, setAccentColor] = useState("");
  const [savingBranding, setSavingBranding] = useState(false);

  const base = `/s/${encodeURIComponent(slug)}`;

  const loadQuestions = useCallback(async () => {
    try {
      setLoadingQuestions(true);
      const res = await spaceFetch(slug, "/questions", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;
      setQuestions(
        data.map((q: Question) => ({
          id: q.id,
          title: q.title,
          imageUrl: q.imageUrl,
          yesMeans: q.yesMeans,
          noMeans: q.noMeans,
        }))
      );
      setDrafts((prev) => {
        const next = { ...prev };
        for (const q of data as Question[]) {
          if (next[q.id] === undefined && q.imageUrl) {
            next[q.id] = q.imageUrl;
          }
        }
        return next;
      });
      setClarifierDrafts((prev) => {
        const next = { ...prev };
        for (const q of data as Question[]) {
          if (next[q.id] === undefined) {
            next[q.id] = {
              yes: q.yesMeans ?? "",
              no: q.noMeans ?? "",
            };
          }
        }
        return next;
      });
    } catch {
      /* ignore */
    } finally {
      setLoadingQuestions(false);
    }
  }, [slug]);

  const loadPetitions = useCallback(async () => {
    try {
      setLoadingPetitions(true);
      const res = await spaceFetch(slug, "/petitions", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setPetitions(Array.isArray(data) ? data : []);
    } catch {
      /* ignore */
    } finally {
      setLoadingPetitions(false);
    }
  }, [slug]);

  useEffect(() => {
    loadQuestions();
    loadPetitions();
  }, [loadQuestions, loadPetitions]);

  useEffect(() => {
    async function loadBranding() {
      try {
        const res = await fetch(`${API_BASE}/spaces/${encodeURIComponent(slug)}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          branding?: { logoUrl?: string; accentColor?: string };
        };
        if (data.branding?.logoUrl) setLogoUrl(String(data.branding.logoUrl));
        if (data.branding?.accentColor) setAccentColor(String(data.branding.accentColor));
      } catch {
        /* ignore */
      }
    }
    loadBranding();
  }, [slug]);

  async function saveBranding() {
    try {
      setSavingBranding(true);
      setMessage("");
      const res = await spaceFetch(slug, "/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branding:
            logoUrl.trim() === "" && accentColor.trim() === ""
              ? null
              : {
                  logoUrl: logoUrl.trim() || undefined,
                  accentColor: accentColor.trim() || undefined,
                },
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || "Save branding failed");
      setMessage("Branding saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save branding failed");
    } finally {
      setSavingBranding(false);
    }
  }

  async function saveClarifiers(questionId: number) {
    const d = clarifierDrafts[questionId] ?? { yes: "", no: "" };
    try {
      setSavingClarifierId(questionId);
      setMessage("");
      const res = await spaceFetch(slug, `/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yesMeans: d.yes.trim() === "" ? null : d.yes,
          noMeans: d.no.trim() === "" ? null : d.no,
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || "Save failed");
      }
      await loadQuestions();
      setMessage("Vote labels saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingClarifierId(null);
    }
  }

  async function saveImage(questionId: number) {
    const raw = drafts[questionId] ?? "";
    try {
      setSavingId(questionId);
      setMessage("");
      const res = await spaceFetch(slug, `/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: raw.trim() === "" ? null : raw.trim(),
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || "Save failed");
      }
      await loadQuestions();
      setMessage("Image URL saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  }

  const downloadExport = useCallback(
    async (kind: string) => {
      try {
        setMessage("");
        const res = await spaceFetch(
          slug,
          `/export.csv?kind=${encodeURIComponent(kind)}`
        );
        if (!res.ok) {
          const t = await res.text();
          setMessage(t || "Export failed");
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${slug}-${kind}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        setMessage(`Downloaded ${kind}.csv`);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Export failed");
      }
    },
    [slug]
  );

  async function createPetition() {
    if (!petitionTitle.trim() || !petitionDesc.trim()) {
      setMessage("Petition title and description are required.");
      return;
    }
    try {
      setCreatingPetition(true);
      setMessage("");
      const goal =
        petitionGoal.trim() === "" ? undefined : Number(petitionGoal.trim());
      const res = await spaceFetch(slug, "/petitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: petitionTitle.trim(),
          description: petitionDesc.trim(),
          goalSignatures:
            typeof goal === "number" && Number.isFinite(goal) && goal > 0
              ? Math.floor(goal)
              : undefined,
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || "Create petition failed");
      setPetitionTitle("");
      setPetitionDesc("");
      setPetitionGoal("");
      setMessage("Petition created.");
      await loadPetitions();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Create petition failed");
    } finally {
      setCreatingPetition(false);
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
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200"
            >
              Home
            </Link>
            <Link
              href="/"
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200"
            >
              Directory
            </Link>
            <Link
              href={base}
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200"
            >
              Overview
            </Link>
            <Link
              href={`${base}/submit`}
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200"
            >
              Submit
            </Link>
            <Link
              href={`${base}/admin`}
              className="rounded-md border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200"
            >
              Admin
            </Link>
            <Link
              href={`${base}/insights`}
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200"
            >
              Insights
            </Link>
            <Link
              href={`${base}/petitions`}
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200"
            >
              Petitions
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12 lg:px-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Admin · {slug}
        </p>
        <h1 className="font-display mt-2 text-3xl font-medium text-zinc-50">
          Run this desk
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-zinc-400">
          New concerns are clustered into vote-ready questions automatically in the
          background. Assign a hero image (https URL) for each issue — it appears on
          the group home and question page.
        </p>

        <div className="mt-10 rounded-sm border border-zinc-800 bg-zinc-900/35 p-8">
          <h2 className="font-display text-lg font-medium text-zinc-50">
            How issues appear
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            When someone submits a concern, the system runs AI clustering shortly
            afterward (merge into existing issues or create new ones). Refresh this
            page after submissions if questions are not visible yet.
          </p>
        </div>

        <div className="mt-10 rounded-sm border border-zinc-800 bg-zinc-900/25 p-8">
          <h2 className="font-display text-lg font-medium text-zinc-50">
            Organisation branding
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">
            Add a logo and (optional) accent color so this group looks like your council
            or organisation across cards and headers.
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Logo URL (https)
              </label>
              <input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="w-full rounded-sm border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/30"
                placeholder="https://…"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Accent color (optional)
              </label>
              <input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-full rounded-sm border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/30"
                placeholder="#0ea5e9"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={savingBranding}
              onClick={saveBranding}
              className="rounded-sm bg-zinc-100 px-5 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:opacity-50"
            >
              {savingBranding ? "Saving…" : "Save branding"}
            </button>
            <div className="flex items-center gap-3 rounded-sm border border-zinc-800 bg-zinc-950/50 px-4 py-3">
              {logoUrl.trim() ? (
                // eslint-disable-next-line @next/next/no-img-element -- org logos can be on any host (https only)
                <img
                  src={logoUrl.trim()}
                  alt=""
                  className="h-9 w-9 rounded-md border border-zinc-800 bg-zinc-950 object-contain p-1"
                />
              ) : (
                <div className="h-9 w-9 rounded-md border border-zinc-800 bg-zinc-950" />
              )}
              <div className="text-xs text-zinc-400">
                Preview
                <div
                  className="mt-1 h-1.5 w-24 rounded-full bg-zinc-800"
                  style={
                    accentColor.trim()
                      ? { backgroundColor: accentColor.trim() }
                      : undefined
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-sm border border-zinc-800 bg-zinc-900/25 p-8">
          <h2 className="font-display text-lg font-medium text-zinc-50">
            Export CSV
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">
            Download reports for meetings, newsletters, or sponsors. Host access
            required (use your admin link with{" "}
            <span className="font-mono">?host=</span>).
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {(
              [
                ["votes", "Votes & demographics"],
                ["vote_flips", "Vote changes (mind changes)"],
                ["questions", "Questions summary"],
                ["submissions", "Submissions"],
                ["petitions", "Petitions"],
                ["petition_signatures", "Petition signatures"],
                ["question_comments", "Question comments"],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                onClick={() => downloadExport(kind)}
                className="rounded-sm border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 rounded-sm border border-zinc-800 bg-zinc-900/25 p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-medium text-zinc-50">
                Petitions
              </h2>
              <p className="mt-2 text-sm text-zinc-500">
                Create a petition people can sign in <span className="font-mono">/petitions</span>.
              </p>
            </div>
            <Link
              href={`${base}/petitions`}
              className="rounded-sm border border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-100"
            >
              Open petitions page
            </Link>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-sm border border-zinc-800 bg-zinc-950/40 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                New petition
              </p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    Title
                  </label>
                  <input
                    value={petitionTitle}
                    onChange={(e) => setPetitionTitle(e.target.value)}
                    className="w-full rounded-sm border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/30"
                    placeholder="e.g. Fund safer crossings"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    Description
                  </label>
                  <textarea
                    value={petitionDesc}
                    onChange={(e) => setPetitionDesc(e.target.value)}
                    rows={5}
                    className="w-full rounded-sm border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/30"
                    placeholder="What are you asking for, and why?"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    Goal (optional)
                  </label>
                  <input
                    inputMode="numeric"
                    value={petitionGoal}
                    onChange={(e) => setPetitionGoal(e.target.value)}
                    className="w-full rounded-sm border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500/30"
                    placeholder="e.g. 500"
                  />
                </div>
                <button
                  type="button"
                  disabled={creatingPetition}
                  onClick={createPetition}
                  className="rounded-sm bg-zinc-100 px-5 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:opacity-50"
                >
                  {creatingPetition ? "Creating…" : "Create petition"}
                </button>
              </div>
            </div>

            <div className="rounded-sm border border-zinc-800 bg-zinc-950/40 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Existing
              </p>
              {loadingPetitions ? (
                <p className="mt-4 text-sm text-zinc-500">Loading…</p>
              ) : petitions.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-500">No petitions yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {petitions.slice(0, 6).map((p) => (
                    <li
                      key={p.id}
                      className="rounded-sm border border-zinc-800 bg-zinc-950/50 p-4"
                    >
                      <p className="font-mono text-[10px] text-zinc-600">
                        Petition #{p.id}
                      </p>
                      <p className="mt-1 font-display text-sm font-medium text-zinc-200">
                        {p.title}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {(p.signatureCount ?? 0).toLocaleString()} signatures
                        {p.goalSignatures
                          ? ` · goal ${p.goalSignatures.toLocaleString()}`
                          : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-sm border border-zinc-800 bg-zinc-900/25 p-8">
          <h2 className="font-display text-lg font-medium text-zinc-50">
            Issue artwork
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Paste an <strong className="font-medium text-zinc-400">https</strong>{" "}
            image URL (e.g. from your CMS or Unsplash). Clear the field and save
            to remove.
          </p>

          {loadingQuestions ? (
            <p className="mt-6 text-sm text-zinc-500">Loading questions…</p>
          ) : questions.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-500">
              No questions yet — they appear after the first concerns are submitted
              and clustering finishes (usually within a few seconds).
            </p>
          ) : (
            <ul className="mt-8 space-y-8">
              {questions.map((q) => (
                <li
                  key={q.id}
                  className="border-b border-zinc-800 pb-8 last:border-0 last:pb-0"
                >
                  <p className="font-mono text-[10px] text-zinc-600">#{q.id}</p>
                  <p className="font-display mt-1 text-base font-medium text-zinc-100">
                    {q.title}
                  </p>
                  <label className="mt-4 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    Image URL (https)
                  </label>
                  <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <input
                      type="url"
                      value={
                        drafts[q.id] !== undefined
                          ? drafts[q.id]
                          : (q.imageUrl ?? "")
                      }
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [q.id]: e.target.value }))
                      }
                      placeholder="https://…"
                      className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                    />
                    <button
                      type="button"
                      disabled={savingId === q.id}
                      onClick={() => saveImage(q.id)}
                      className="shrink-0 rounded-md border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {savingId === q.id ? "Saving…" : "Save"}
                    </button>
                  </div>
                  {q.imageUrl ? (
                    <div className="relative mt-4 aspect-[16/6] max-w-lg overflow-hidden rounded-sm bg-zinc-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={q.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : null}

                  <div className="mt-8 border-t border-zinc-800 pt-8">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      What Yes / No mean
                    </p>
                    <p className="mt-2 text-sm text-zinc-500">
                      Shown on the question page before people vote. Use plain language
                      (e.g. what council action you are endorsing).
                    </p>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div>
                        <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                          A &quot;Yes&quot; vote means
                        </label>
                        <textarea
                          value={
                            clarifierDrafts[q.id]?.yes ??
                            q.yesMeans ??
                            ""
                          }
                          onChange={(e) =>
                            setClarifierDrafts((prev) => ({
                              ...prev,
                              [q.id]: {
                                yes: e.target.value,
                                no: prev[q.id]?.no ?? q.noMeans ?? "",
                              },
                            }))
                          }
                          rows={3}
                          placeholder="e.g. Yes = support funding this scheme from the highways budget."
                          className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                          A &quot;No&quot; vote means
                        </label>
                        <textarea
                          value={
                            clarifierDrafts[q.id]?.no ??
                            q.noMeans ??
                            ""
                          }
                          onChange={(e) =>
                            setClarifierDrafts((prev) => ({
                              ...prev,
                              [q.id]: {
                                yes: prev[q.id]?.yes ?? q.yesMeans ?? "",
                                no: e.target.value,
                              },
                            }))
                          }
                          rows={3}
                          placeholder="e.g. No = do not prioritise this; keep the status quo."
                          className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={savingClarifierId === q.id}
                      onClick={() => saveClarifiers(q.id)}
                      className="mt-4 rounded-md border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {savingClarifierId === q.id ? "Saving…" : "Save vote labels"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {message && (
          <div className="mt-8 rounded-sm border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-300">
            {message}
          </div>
        )}
      </section>
    </main>
  );
}
