"use client";

import { use, useEffect, useMemo, useState } from "react";
import { QuestionDiscussion } from "../../../../components/QuestionDiscussion";
import { SocialShareButtons } from "../../../../components/SocialShareButtons";
import { SpaceFlowNav } from "../../../../components/SpaceFlowNav";
import { SITE_URL } from "../../../../../lib/siteUrl";
import { spaceFetch } from "../../../../../lib/spaceApi";

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
  yesMeans?: string;
  noMeans?: string;
  createdAt?: number;
};

type QuestionUpdate = {
  id: number;
  title: string;
  body: string;
  createdAt?: number;
};

export default function SpaceQuestionDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = use(params);
  const questionId = Number(id);

  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [existingVote, setExistingVote] = useState<"yes" | "no" | null>(null);
  const [gender, setGender] = useState("prefer_not");
  const [ageRange, setAgeRange] = useState("prefer_not");
  const [country, setCountry] = useState("");
  const [town, setTown] = useState("");
  const [updates, setUpdates] = useState<QuestionUpdate[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [canChangeVote, setCanChangeVote] = useState(true);

  const storageKey = useMemo(
    () => `agentis-vote-${slug}-${questionId}`,
    [slug, questionId]
  );

  const sharePageUrl = useMemo(
    () =>
      `${SITE_URL}/s/${encodeURIComponent(slug)}/questions/${encodeURIComponent(id)}`,
    [slug, id]
  );

  useEffect(() => {
    try {
      const savedVote = window.localStorage.getItem(storageKey);
      if (savedVote === "yes" || savedVote === "no") {
        setExistingVote(savedVote);
      }
      if (window.localStorage.getItem(`${storageKey}-change-exhausted`) === "1") {
        setCanChangeVote(false);
      } else {
        setCanChangeVote(true);
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  useEffect(() => {
    async function loadQuestion() {
      try {
        setLoading(true);
        setError("");

        const res = await spaceFetch(slug, "/questions", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to load questions");
        }

        const data: Question[] = await res.json();
        const found = data.find((q) => q.id === questionId) || null;

        if (!found) {
          throw new Error("Question not found");
        }

        setQuestion(found);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }

    if (!Number.isNaN(questionId)) {
      loadQuestion();
    } else {
      setError("Invalid question id");
      setLoading(false);
    }
  }, [questionId, slug]);

  useEffect(() => {
    async function loadUpdates() {
      if (!Number.isFinite(questionId)) return;
      try {
        setUpdatesLoading(true);
        const res = await spaceFetch(slug, `/questions/${questionId}/updates`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as unknown;
        setUpdates(Array.isArray(data) ? (data as QuestionUpdate[]) : []);
      } catch {
        /* ignore */
      } finally {
        setUpdatesLoading(false);
      }
    }
    loadUpdates();
  }, [questionId, slug]);

  async function handleVote(vote: "yes" | "no") {
    if (!question || submittingVote) return;
    if (existingVote === vote) return;

    try {
      setSubmittingVote(true);
      setMessage("");
      setError("");

      const res = await spaceFetch(slug, "/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionId: question.id,
          vote,
          demographics: {
            gender,
            ageRange,
            country: country.trim() || undefined,
            town: town.trim() || undefined,
          },
        }),
      });

      const text = await res.text();

      if (!res.ok) {
        if (res.status === 409) {
          try {
            const j = JSON.parse(text) as { code?: string; error?: string };
            if (j.code === "VOTE_CHANGE_LIMIT") {
              setCanChangeVote(false);
              try {
                window.localStorage.setItem(`${storageKey}-change-exhausted`, "1");
              } catch {
                /* ignore */
              }
              setError(
                typeof j.error === "string"
                  ? j.error
                  : "You have already used your one vote change."
              );
              return;
            }
          } catch {
            /* fall through */
          }
        }
        try {
          const j = JSON.parse(text) as { error?: string };
          throw new Error(
            typeof j?.error === "string" ? j.error : text || "Failed to vote"
          );
        } catch (e) {
          if (e instanceof Error && e.message !== text) throw e;
          throw new Error(text || "Failed to vote");
        }
      }

      const data = JSON.parse(text) as {
        question?: Question;
        voteStatus?: "created" | "changed" | "unchanged";
        previousVote?: "yes" | "no";
        canChangeVote?: boolean;
      };

      if (data?.question) {
        setQuestion(data.question);
      }

      if (typeof data.canChangeVote === "boolean") {
        setCanChangeVote(data.canChangeVote);
        if (!data.canChangeVote) {
          try {
            window.localStorage.setItem(`${storageKey}-change-exhausted`, "1");
          } catch {
            /* ignore */
          }
        }
      }

      setExistingVote(vote);

      try {
        window.localStorage.setItem(storageKey, vote);
      } catch {
        // ignore
      }

      const status = data.voteStatus;
      if (status === "changed" && data.previousVote) {
        setMessage(
          `Your vote was updated from ${data.previousVote.toUpperCase()} to ${vote.toUpperCase()}. Your one allowed change is used; you cannot switch again.`
        );
      } else if (status === "unchanged") {
        setMessage(`Your ${vote.toUpperCase()} vote is unchanged.`);
      } else {
        setMessage(`Your ${vote.toUpperCase()} vote was recorded.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Voting failed");
    } finally {
      setSubmittingVote(false);
    }
  }

  const totalVotes = (question?.votesYes || 0) + (question?.votesNo || 0);
  const yesPercent =
    totalVotes > 0 && question ? Math.round((question.votesYes / totalVotes) * 100) : 0;
  const noPercent =
    totalVotes > 0 && question ? Math.round((question.votesNo / totalVotes) * 100) : 0;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SpaceFlowNav slug={slug} active="question" />

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-10">
        {loading && (
          <div className="rounded-sm border border-zinc-800 bg-zinc-900/25 p-8">
            Loading question...
          </div>
        )}

        {error && (
          <div className="rounded-sm border border-red-900/50 bg-red-950/30 p-6 text-red-200/90">
            {error}
          </div>
        )}

        {!loading && !error && question && (
          <article className="overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900/25">
            {question.imageUrl ? (
              <div className="relative aspect-[21/9] w-full bg-zinc-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={question.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/20 to-transparent"
                  aria-hidden
                />
              </div>
            ) : null}

            <div className="p-8">
              <div className="mb-4 inline-flex rounded border border-zinc-700 bg-zinc-950/50 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                {question.clusterId}
              </div>

              <h1 className="font-display text-3xl font-medium tracking-tight text-zinc-50 sm:text-4xl">
                {question.title}
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-400 sm:text-[15px]">
                {question.description}
              </p>

              <div className="mt-6">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Share
                </p>
                <SocialShareButtons
                  title={question.title}
                  text={`Vote on: ${question.title}`}
                  url={sharePageUrl}
                />
              </div>

              <div className="mt-8">
                <div className="mb-3 flex items-end justify-between gap-4">
                  <h2 className="font-display text-lg font-medium text-zinc-50">
                    Updates
                  </h2>
                  <p className="text-xs text-zinc-500">
                    {updatesLoading ? "Loading…" : `${updates.length} posted`}
                  </p>
                </div>
                {updates.length === 0 ? (
                  <div className="rounded-sm border border-dashed border-zinc-800 bg-zinc-950/40 p-5 text-sm text-zinc-500">
                    No updates yet.
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {updates.map((u) => (
                      <li
                        key={u.id}
                        className="rounded-sm border border-zinc-800 bg-zinc-950/40 p-5"
                      >
                        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          {u.title}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                          {u.body}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-8 grid gap-4 lg:grid-cols-2">
              <div className="rounded-sm border border-zinc-800 bg-zinc-950/40 p-5">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-300">
                  Arguments For
                </h2>
                <ul className="space-y-3 text-sm leading-6 text-zinc-200">
                  {question.argumentsFor.map((argument, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-zinc-100" />
                      <span>{argument}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-sm border border-zinc-800 bg-zinc-950/40 p-5">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-300">
                  Arguments Against
                </h2>
                <ul className="space-y-3 text-sm leading-6 text-zinc-200">
                  {question.argumentsAgainst.map((argument, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-zinc-400" />
                      <span>{argument}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {(question.yesMeans || question.noMeans) && (
              <div className="mt-8 rounded-sm border border-zinc-700 bg-zinc-950/50 p-5">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-300">
                  What you&apos;re voting on
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {question.yesMeans ? (
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                        A &quot;Yes&quot; means
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                        {question.yesMeans}
                      </p>
                    </div>
                  ) : null}
                  {question.noMeans ? (
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                        A &quot;No&quot; means
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                        {question.noMeans}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            <div className="mt-8 grid gap-4 sm:grid-cols-4">
              <div className="rounded-sm border border-zinc-800 bg-zinc-950/40 p-4">
                <p className="text-xs text-zinc-500">Yes votes</p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">
                  {question.votesYes}
                </p>
              </div>

              <div className="rounded-sm border border-zinc-800 bg-zinc-950/40 p-4">
                <p className="text-xs text-zinc-500">No votes</p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">
                  {question.votesNo}
                </p>
              </div>

              <div className="rounded-sm border border-zinc-800 bg-zinc-950/40 p-4">
                <p className="text-xs text-zinc-500">Total votes</p>
                <p className="mt-2 text-3xl font-semibold text-zinc-50">
                  {totalVotes}
                </p>
              </div>

              <div className="rounded-sm border border-zinc-800 bg-zinc-950/40 p-4">
                <p className="text-xs text-zinc-500">Your vote</p>
                <p className="mt-2 text-lg font-semibold text-zinc-100">
                  {existingVote ? existingVote.toUpperCase() : "Not voted"}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-sm border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="mb-3 flex items-center justify-between text-xs text-zinc-500">
                <span>Vote split</span>
                <span>
                  Yes {yesPercent}% · No {noPercent}%
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full bg-zinc-100" style={{ width: `${yesPercent}%` }} />
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-4">
              <div className="w-full rounded-sm border border-zinc-800 bg-zinc-950/40 p-4">
                <p className="mb-3 text-sm font-medium text-zinc-200">
                  Optional: add demographics for better insights
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">Gender</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full rounded-sm border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
                    >
                      <option value="prefer_not">Prefer not to say</option>
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="nonbinary">Non-binary</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">
                      Age range
                    </label>
                    <select
                      value={ageRange}
                      onChange={(e) => setAgeRange(e.target.value)}
                      className="w-full rounded-sm border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
                    >
                      <option value="prefer_not">Prefer not to say</option>
                      <option value="under_18">Under 18</option>
                      <option value="18_24">18–24</option>
                      <option value="25_34">25–34</option>
                      <option value="35_44">35–44</option>
                      <option value="45_54">45–54</option>
                      <option value="55_64">55–64</option>
                      <option value="65_plus">65+</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">
                      Country
                    </label>
                    <input
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="e.g. US"
                      className="w-full rounded-sm border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">
                      Town / city
                    </label>
                    <input
                      value={town}
                      onChange={(e) => setTown(e.target.value)}
                      placeholder="e.g. Leeds"
                      className="w-full rounded-sm border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600"
                    />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleVote("yes")}
                disabled={
                  submittingVote ||
                  existingVote === "yes" ||
                  (existingVote === "no" && !canChangeVote)
                }
                className={`rounded-sm px-6 py-2.5 text-sm font-medium transition ${
                  existingVote === "yes"
                    ? "bg-zinc-100 text-zinc-950"
                    : "bg-zinc-100 text-zinc-950 hover:bg-white"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {submittingVote
                  ? "Submitting..."
                  : existingVote === "yes"
                  ? "You voted Yes"
                  : "Vote Yes"}
              </button>

              <button
                type="button"
                onClick={() => handleVote("no")}
                disabled={
                  submittingVote ||
                  existingVote === "no" ||
                  (existingVote === "yes" && !canChangeVote)
                }
                className="rounded-sm border border-zinc-700 bg-zinc-950 px-6 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submittingVote
                  ? "Submitting..."
                  : existingVote === "no"
                  ? "You voted No"
                  : "Vote No"}
              </button>
            </div>

            {message && (
              <div className="mt-6 rounded-sm border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-300">
                {message}
              </div>
            )}

            {existingVote && (
              <div className="mt-4 rounded-sm border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-300">
                One vote per device. You may switch once (Yes ↔ No); after that
                your choice is final. Vote changes are counted for insights (time
                since your first vote).
              </div>
            )}

            <QuestionDiscussion
              mode="space"
              slug={slug}
              questionId={questionId}
            />
            </div>
          </article>
        )}
      </section>
    </main>
  );
}
