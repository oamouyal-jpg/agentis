"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { FollowGroupButton } from "./components/FollowGroupButton";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { ShareButton } from "./components/ShareButton";
import { PressDeskHero } from "./components/press/PressDeskHero";
import { SpaceTrendingSection } from "./components/SpaceTrendingSection";
import { useI18n } from "../lib/i18n/I18nProvider";
import { API_BASE } from "../lib/apiBase";
import { useMyGroups } from "../lib/useMyGroups";

type SpaceListItem = {
  id: number;
  name: string;
  slug: string;
  description: string;
  visibility: "public" | "members_only";
  membersOnly: boolean;
  branding?: { logoUrl?: string; accentColor?: string };
};

function SpaceActionBar({
  slug,
  name,
  isMembers,
}: {
  slug: string;
  name: string;
  isMembers: boolean;
}) {
  const { t } = useI18n();
  const base = `/s/${encodeURIComponent(slug)}`;
  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-zinc-800 pt-5">
      <div className="flex flex-wrap items-center gap-2">
        <FollowGroupButton slug={slug} name={name} />
      </div>
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">
        {t("spaceActions.actions")}
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href={base}
          className="inline-flex flex-1 min-w-[7.5rem] items-center justify-center rounded-md bg-zinc-100 px-3 py-2.5 text-center text-sm font-medium text-zinc-950 transition hover:bg-white sm:flex-none"
        >
          {t("spaceActions.open")}
        </Link>
        <Link
          href={`${base}/submit`}
          className="inline-flex flex-1 min-w-[7.5rem] items-center justify-center rounded-md border border-zinc-700 bg-zinc-900/50 px-3 py-2.5 text-center text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
        >
          {t("spaceActions.shareSomething")}
        </Link>
        <Link
          href={`${base}/insights`}
          className="inline-flex flex-1 min-w-[7.5rem] items-center justify-center rounded-md border border-zinc-700 bg-zinc-900/50 px-3 py-2.5 text-center text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800"
        >
          {t("spaceActions.results")}
        </Link>
        <Link
          href={`${base}/admin`}
          className="inline-flex flex-1 min-w-[7.5rem] items-center justify-center rounded-md border border-zinc-700 bg-zinc-900/50 px-3 py-2.5 text-center text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
        >
          {t("spaceActions.forHosts")}
        </Link>
      </div>
      {isMembers && (
        <p className="text-xs leading-relaxed text-zinc-500">
          {t("spaceActions.inviteNote")}
        </p>
      )}
    </div>
  );
}

export default function HomePage() {
  const { t } = useI18n();
  const router = useRouter();
  const { groups: myGroups, unfollow } = useMyGroups();
  const [joinSlug, setJoinSlug] = useState("");
  const [spaces, setSpaces] = useState<SpaceListItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [openQuestionCount, setOpenQuestionCount] = useState<number | null>(null);
  const [wireQuestions, setWireQuestions] = useState<
    { id: number; title: string; imageUrl?: string }[]
  >([]);
  const [openStatsLoading, setOpenStatsLoading] = useState(true);

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
        const raw = e instanceof Error ? e.message : "Failed to load spaces";
        const network =
          raw === "Failed to fetch" ||
          raw === "Load failed" ||
          raw.includes("NetworkError");
        setError(network ? t("home.errors.loadNetwork") : raw);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    async function loadOpenStats() {
      try {
        setOpenStatsLoading(true);
        const res = await fetch(`${API_BASE}/spaces/open/questions`, {
          cache: "no-store",
        });
        if (!res.ok) {
          setOpenQuestionCount(null);
          setWireQuestions([]);
          return;
        }
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setOpenQuestionCount(list.length);
        setWireQuestions(
          list
            .slice(0, 4)
            .map((q: { id: number; title: string; imageUrl?: string }) => ({
              id: q.id,
              title: q.title,
              imageUrl: q.imageUrl,
            }))
        );
      } catch {
        setOpenQuestionCount(null);
        setWireQuestions([]);
      } finally {
        setOpenStatsLoading(false);
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

  function handleJoinBySlug(e: FormEvent) {
    e.preventDefault();
    const raw = joinSlug.trim().toLowerCase().replace(/\s+/g, "-");
    if (!raw) return;
    router.push(`/s/${encodeURIComponent(raw)}`);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateMsg("");
    if (!name.trim() || !slug.trim()) {
      setCreateMsg(t("home.createNeedName"));
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
      let data: { error?: string; inviteSecret?: string; space?: { slug: string } } =
        {};
      try {
        data = await res.json();
      } catch {
        if (!res.ok) {
          throw new Error(t("home.errors.createGeneric"));
        }
      }
      if (!res.ok) {
        throw new Error(data.error || "Create failed");
      }
      const createdSlug = data.space?.slug ?? "";
      setCreateMsg(
        data.inviteSecret && createdSlug
          ? t("home.createSuccessInvite", {
              invite: data.inviteSecret,
              link: `/s/${createdSlug}?invite=${encodeURIComponent(data.inviteSecret)}`,
            })
          : t("home.createSuccess")
      );
      setName("");
      setSlug("");
      setDescription("");
      const listRes = await fetch(`${API_BASE}/spaces`, { cache: "no-store" });
      if (listRes.ok) {
        setSpaces(await listRes.json());
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Create failed";
      const network =
        msg === "Failed to fetch" ||
        msg === "Load failed" ||
        msg.includes("NetworkError");
      setCreateMsg(network ? t("home.errors.createNetwork") : msg);
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,255,255,0.06),transparent_55%)]"
        aria-hidden
      />
      <div className="relative z-10">
        <header className="border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-sm">
          <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-10">
            <Link
              href="/"
              className="font-display text-base font-medium tracking-tight text-zinc-100"
            >
              {t("common.agentis")}
            </Link>
            <nav className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:text-xs">
              <Link href="/my-groups" className="font-medium text-zinc-400 transition hover:text-zinc-100">{t("home.myGroupsTitle")}</Link>
              <ShareButton text="Check out Agentis" />
              <LanguageSwitcher />
            </nav>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12 lg:px-10">
          <PressDeskHero
            openQuestionCount={openQuestionCount}
            wireQuestions={wireQuestions}
            statsLoading={openStatsLoading}
            groupCount={loading ? null : spaces.length}
            groupsLoading={loading}
          />

          <SpaceTrendingSection slug="open" />

          <section className="mb-6 rounded-sm border border-zinc-800 bg-zinc-900/35 p-4 sm:mb-10 sm:p-8">
            <h2 className="font-display text-lg font-medium text-zinc-50">
              {t("home.getStartedTitle")}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
              {t("home.getStartedBody")}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-stretch sm:gap-4">
              <Link
                href="/s/open"
                className="inline-flex items-center justify-center rounded-md bg-zinc-100 px-8 py-3 text-center text-sm font-medium text-zinc-950 transition hover:bg-white"
              >
                {t("home.enterPublicGroup")}
              </Link>
              <form
                onSubmit={handleJoinBySlug}
                className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-md sm:flex-row sm:items-center"
              >
                <input
                  value={joinSlug}
                  onChange={(e) => setJoinSlug(e.target.value)}
                  placeholder={t("home.groupNamePlaceholder")}
                  className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                  aria-label={t("home.labelGroupName")}
                />
                <button
                  type="submit"
                  className="rounded-md border border-zinc-600 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
                >
                  {t("home.go")}
                </button>
              </form>
            </div>
            <p className="mt-6 text-xs text-zinc-500">{t("home.inviteOnlyHint")}</p>
            <p className="mt-3 text-sm text-zinc-500">
              {t("home.hostingPrefix")}{" "}
              <a
                href="#create-group"
                className="font-medium text-zinc-300 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-100"
              >
                {t("home.createGroupLink")}
              </a>
            </p>
          </section>

          {/* Create — always visible (not tucked away) */}
          <section
            id="create-group"
            className="mb-6 rounded-sm border border-zinc-800 bg-zinc-900/35 p-4 sm:mb-10 sm:p-8"
          >
            <h2 className="font-display text-lg font-medium text-zinc-50">
              {t("home.createTitle")}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
              {t("home.createBody")}
            </p>
            <form onSubmit={handleCreate} className="mt-6 max-w-lg space-y-4 sm:mt-8">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {t("home.labelGroupName")}
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                  placeholder={t("home.phGroupName")}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {t("home.labelShortName")}
                </label>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                  placeholder={t("home.phShortName")}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {t("home.labelDescription")}
                </label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                  placeholder={t("home.phDescription")}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {t("home.labelAccess")}
                </label>
                <select
                  value={visibility}
                  onChange={(e) =>
                    setVisibility(e.target.value as "public" | "members_only")
                  }
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                >
                  <option value="public">{t("home.accessPublic")}</option>
                  <option value="members_only">
                    {t("home.accessRestricted")}
                  </option>
                </select>
              </div>
              <button
                type="submit"
                disabled={creating}
                className="rounded-md bg-zinc-100 px-5 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:opacity-50"
              >
                {creating ? t("home.creating") : t("home.createSubmit")}
              </button>
            </form>
            {createMsg && (
              <p className="mt-6 max-w-lg whitespace-pre-wrap rounded-md border border-zinc-800 bg-zinc-950/80 p-4 text-sm text-zinc-300">
                {createMsg}
              </p>
            )}
          </section>

          {/* Spaces — primary content, full width */}
          <section className="mb-10">
            <div className="mb-8 border-b border-zinc-800 pb-8">
              <h2 className="font-display text-xl font-medium text-zinc-50">
                {t("home.directoryTitle")}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-zinc-500">
                {t("home.directoryBody")}
              </p>
            </div>

            {error && (
              <div className="mb-6 rounded-md border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-200/90">
                {error}
              </div>
            )}

            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-52 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900/40"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-10">
                {publicSpaces.length > 0 && (
                  <div>
                    <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      {t("home.openAccess")}
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {publicSpaces.map((s) => (
                        <article
                          key={s.id}
                          className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6 transition hover:border-zinc-700"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              {s.branding?.logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element -- org logos can be on any host (https only)
                                <img
                                  src={s.branding.logoUrl}
                                  alt=""
                                  className="h-10 w-10 shrink-0 rounded-md border border-zinc-800 bg-zinc-950 object-contain p-1"
                                />
                              ) : (
                                <div className="h-10 w-10 shrink-0 rounded-md border border-zinc-800 bg-zinc-950" />
                              )}
                              <div className="min-w-0">
                                <h3
                                  className="text-base font-semibold text-zinc-100"
                                  style={
                                    s.branding?.accentColor
                                      ? { color: s.branding.accentColor }
                                      : undefined
                                  }
                                >
                                  {s.name}
                                </h3>
                                <p className="mt-1 font-mono text-[11px] text-zinc-600">
                                  {s.slug}
                                </p>
                              </div>
                            </div>
                            <span className="shrink-0 rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                              {t("home.badgeOpen")}
                            </span>
                          </div>
                          {s.description ? (
                            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                              {s.description}
                            </p>
                          ) : null}
                          <SpaceActionBar
                            slug={s.slug}
                            name={s.name}
                            isMembers={false}
                          />
                        </article>
                      ))}
                    </div>
                  </div>
                )}

                {membersSpaces.length > 0 && (
                  <div>
                    <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      {t("home.restrictedAccess")}
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {membersSpaces.map((s) => (
                        <article
                          key={s.id}
                          className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6 transition hover:border-zinc-700"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              {s.branding?.logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element -- org logos can be on any host (https only)
                                <img
                                  src={s.branding.logoUrl}
                                  alt=""
                                  className="h-10 w-10 shrink-0 rounded-md border border-zinc-800 bg-zinc-950 object-contain p-1"
                                />
                              ) : (
                                <div className="h-10 w-10 shrink-0 rounded-md border border-zinc-800 bg-zinc-950" />
                              )}
                              <div className="min-w-0">
                                <h3
                                  className="text-base font-semibold text-zinc-100"
                                  style={
                                    s.branding?.accentColor
                                      ? { color: s.branding.accentColor }
                                      : undefined
                                  }
                                >
                                  {s.name}
                                </h3>
                                <p className="mt-1 font-mono text-[11px] text-zinc-600">
                                  {s.slug}
                                </p>
                              </div>
                            </div>
                            <span className="shrink-0 rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                              {t("home.badgeRestricted")}
                            </span>
                          </div>
                          {s.description ? (
                            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                              {s.description}
                            </p>
                          ) : null}
                          <SpaceActionBar
                            slug={s.slug}
                            name={s.name}
                            isMembers
                          />
                        </article>
                      ))}
                    </div>
                  </div>
                )}

                {!loading && spaces.length === 0 && (
                  <p className="rounded-md border border-dashed border-zinc-800 bg-zinc-950/50 px-6 py-10 text-center text-sm text-zinc-500">
                    {t("home.directoryEmpty")}
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
