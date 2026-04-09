"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { FollowGroupButton } from "../../components/FollowGroupButton";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { SocialShareButtons } from "../../components/SocialShareButtons";
import { SpaceFlowNav } from "../../components/SpaceFlowNav";
import { SpaceTrendingSection } from "../../components/SpaceTrendingSection";
import { API_BASE } from "../../../lib/apiBase";
import { getInviteForSpace, spaceFetch } from "../../../lib/spaceApi";

type Question = {
  id: number;
  title: string;
  description: string;
  argumentsFor: string[];
  argumentsAgainst: string[];
  clusterId: string;
  sourceSubmissionIds: number[];
  votesYes: number;
  votesNo: number;
  imageUrl?: string;
  createdAt?: number;
};

type SpaceMeta = {
  name?: string;
  branding?: { logoUrl?: string; accentColor?: string };
};

export default function SpaceHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [spaceName, setSpaceName] = useState(slug);
  const [dateLine, setDateLine] = useState("");
  const [branding, setBranding] = useState<SpaceMeta["branding"]>(undefined);

  useEffect(() => {
    setDateLine(
      new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date())
    );
  }, []);

  useEffect(() => {
    async function loadMeta() {
      try {
        const headers = new Headers();
        const inv = getInviteForSpace(slug);
        if (inv) headers.set("X-Space-Invite", inv);
        const res = await fetch(
          `${API_BASE}/spaces/${encodeURIComponent(slug)}`,
          { headers, cache: "no-store" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as SpaceMeta;
        if (typeof data.name === "string" && data.name.trim()) {
          setSpaceName(data.name.trim());
        }
        if (data.branding && typeof data.branding === "object") {
          setBranding(data.branding);
        }
      } catch {
        /* keep fallback */
      }
    }
    loadMeta();
  }, [slug]);

  useEffect(() => {
    async function loadQuestions() {
      try {
        setLoading(true);
        setError("");

        const res = await spaceFetch(slug, "/questions", {
          cache: "no-store",
        });

        const text = await res.text();

        if (!res.ok) {
          throw new Error(`Backend returned ${res.status}: ${text}`);
        }

        const data = JSON.parse(text);
        setQuestions(Array.isArray(data) ? data : []);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load questions";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    loadQuestions();
  }, [slug]);

  const base = `/s/${encodeURIComponent(slug)}`;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SpaceFlowNav
        slug={slug}
        spaceName={spaceName}
        active="group"
        branding={branding}
        extras={
          <>
            <SocialShareButtons
              title={spaceName}
              text={`Join ${spaceName} on Agentis`}
            />
            <LanguageSwitcher />
            <Link
              href="/my-groups"
              className="hidden text-xs font-medium text-zinc-400 transition hover:text-zinc-100 sm:inline"
            >
              My groups
            </Link>
          </>
        }
      />

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-10">
        <div className="mb-10 border-b border-zinc-800 pb-8">
          <h2
            className="font-display text-2xl font-medium tracking-tight text-zinc-50 sm:text-3xl"
            style={
              branding?.accentColor ? { color: branding.accentColor } : undefined
            }
          >
            {spaceName}
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            {questions.length} question{questions.length !== 1 ? "s" : ""} &middot; {dateLine || "—"}
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
            These are live questions for this group. Open one to read context and vote.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <FollowGroupButton slug={slug} name={spaceName} />
            <Link
              href={`${base}/submit`}
              className="inline-flex items-center rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-white"
            >
              Raise your voice
            </Link>
            <Link
              href="/my-groups"
              className="inline-flex items-center rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 sm:hidden"
            >
              My groups
            </Link>
            <Link
              href={`${base}/admin`}
              className="inline-flex items-center rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200 sm:hidden"
            >
              Admin
            </Link>
          </div>
        </div>

        <SpaceTrendingSection slug={slug} />

        <div id="questions" className="mb-6 scroll-mt-24">
          <h3 className="font-display text-lg font-medium text-zinc-50">
            Issues &amp; votes
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            Click a question to read and vote.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-200/90">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="animate-pulse rounded-lg border border-zinc-800 bg-zinc-900/40 p-6"
              >
                <div className="h-5 w-1/3 rounded bg-zinc-800" />
                <div className="mt-4 h-4 w-full rounded bg-zinc-800" />
                <div className="mt-2 h-4 w-4/5 rounded bg-zinc-800" />
              </div>
            ))}
          </div>
        ) : questions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/50 px-8 py-12 text-center">
            <h3 className="text-base font-semibold text-zinc-200">
              No questions yet
            </h3>
            <p className="mt-2 text-sm text-zinc-500">
              Submit concerns from members — questions are generated automatically
              shortly after. Use Admin to add artwork to each issue.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {questions.map((q) => (
              <Link
                key={q.id}
                href={`${base}/questions/${q.id}`}
                className="group block"
              >
                <article className="overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900/30 transition hover:border-zinc-600">
                  <div className="grid md:grid-cols-12">
                    <div className="relative aspect-[16/10] bg-zinc-900 md:col-span-5 md:aspect-auto md:min-h-[220px]">
                      {q.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- https URLs from admin (any host)
                        <img
                          src={q.imageUrl}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:brightness-110"
                        />
                      ) : (
                        <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 px-6 text-center md:min-h-0">
                          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                            No artwork
                          </span>
                          <span className="max-w-[12rem] text-[11px] leading-snug text-zinc-600">
                            Add an https image URL in Admin to show a visual for
                            this issue.
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col justify-between p-6 md:col-span-7">
                      <div>
                        <p className="font-mono text-[10px] text-zinc-600">
                          {q.clusterId}
                        </p>
                        <h3 className="font-display mt-2 text-xl font-medium leading-snug text-zinc-50 sm:text-2xl">
                          {q.title}
                        </h3>
                        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-zinc-400">
                          {q.description}
                        </p>
                      </div>
                      <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-zinc-800/80 pt-5">
                        <div className="flex gap-10">
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                              Yes
                            </p>
                            <p className="font-display text-2xl font-medium tabular-nums text-zinc-100">
                              {q.votesYes}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                              No
                            </p>
                            <p className="font-display text-2xl font-medium tabular-nums text-zinc-100">
                              {q.votesNo}
                            </p>
                          </div>
                        </div>
                        <p className="text-[10px] text-zinc-600">
                          {q.sourceSubmissionIds.length} source inputs
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
