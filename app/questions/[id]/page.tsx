"use client";

import Link from "next/link";
import {
  use,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { QuestionDiscussion } from "../../components/QuestionDiscussion";
import { SocialShareButtons } from "../../components/SocialShareButtons";
import { API_BASE } from "../../../lib/apiBase";
import { DEFAULT_QUESTION_HERO_URL } from "../../../lib/defaultQuestionHero";
import { getOrCreateDeviceId } from "../../../lib/deviceId";
import { voteButtonCopy } from "../../../lib/voteButtonLabels";

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
  myVote?: "yes" | "no";
  myVoteChangeExhausted?: boolean;
  yesButtonLabel?: string;
  noButtonLabel?: string;
};

function formatQuestionAge(createdAt?: number): string | null {
  if (createdAt == null || !Number.isFinite(createdAt)) return null;
  const sec = Math.max(0, Math.floor((Date.now() - createdAt) / 1000));
  if (sec < 45) return "just now";
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d ago`;
  return new Date(createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function QuestionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const questionId = Number(id);

  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [gender, setGender] = useState("prefer_not");
  const [ageRange, setAgeRange] = useState("prefer_not");
  const [country, setCountry] = useState("");
  const [town, setTown] = useState("");

  useLayoutEffect(() => {
    setQuestion(null);
    setMessage("");
    if (!Number.isNaN(questionId)) {
      setLoading(true);
      setError("");
    }
  }, [questionId]);

  useEffect(() => {
    async function loadQuestion() {
      try {
        setLoading(true);
        setError("");

        const deviceId = getOrCreateDeviceId();
        const res = await fetch(`${API_BASE}/questions`, {
          cache: "no-store",
          headers: deviceId ? { "X-Space-Device": deviceId } : {},
        });

        if (!res.ok) {
          throw new Error("Failed to load questions");
        }

        const data: Question[] = await res.json();
        const found =
          data.find((q) => Number(q.id) === questionId) || null;

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
  }, [questionId]);

  const totalVotes = (question?.votesYes || 0) + (question?.votesNo || 0);
  const yesPercent =
    totalVotes > 0 && question ? Math.round((question.votesYes / totalVotes) * 100) : 0;
  const noPercent =
    totalVotes > 0 && question ? Math.round((question.votesNo / totalVotes) * 100) : 0;

  const voteChoice = useMemo((): "yes" | "no" | null => {
    if (!question || question.id !== questionId) return null;
    const v = question.myVote;
    return v === "yes" || v === "no" ? v : null;
  }, [question, questionId]);

  const canChangeVote = useMemo(() => {
    if (!question || question.id !== questionId) return true;
    return question.myVoteChangeExhausted !== true;
  }, [question, questionId]);

  async function handleVote(vote: "yes" | "no") {
    if (!question || submittingVote) return;
    if (question.id !== questionId) return;
    if (voteChoice === vote) return;

    try {
      setSubmittingVote(true);
      setMessage("");
      setError("");

      const deviceId = getOrCreateDeviceId();
      const res = await fetch(`${API_BASE}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(deviceId ? { "X-Space-Device": deviceId } : {}),
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
              setQuestion((q) =>
                q && q.id === questionId
                  ? { ...q, myVoteChangeExhausted: true }
                  : q
              );
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

  const voteLabels = question ? voteButtonCopy(question) : null;

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
              href="/submit"
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-200"
            >
              Submit
            </Link>
            <Link
              href="/insights"
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-200"
            >
              Insights
            </Link>
            <Link
              href="/admin"
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-200"
            >
              Admin
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12 lg:px-10">
        <Link
          href="/"
          className="mb-6 inline-flex rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-200"
        >
          ← Back to questions
        </Link>

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

        {!loading &&
          !error &&
          question &&
          question.id === questionId && (
          <article className="mx-auto max-w-lg overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-950 shadow-[0_28px_90px_-16px_rgba(0,0,0,0.75)] ring-1 ring-white/5">
            <header className="flex items-center gap-3 border-b border-zinc-800/80 px-4 py-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 text-xs font-bold uppercase tracking-wide text-zinc-200"
                aria-hidden
              >
                {question.clusterId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() ||
                  "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-100">
                  {question.clusterId}
                </p>
                <p className="text-xs text-zinc-500">
                  {formatQuestionAge(question.createdAt) ?? "Open space"}
                </p>
              </div>
            </header>

            <div className="relative aspect-[4/5] w-full max-h-[min(78vh,640px)] bg-zinc-950 sm:aspect-[3/4]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={question.imageUrl?.trim() || DEFAULT_QUESTION_HERO_URL}
                alt=""
                className="h-full w-full object-cover"
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/85 via-black/20 to-black/88"
                aria-hidden
              />
              <div className="absolute inset-x-0 top-0 p-5 pt-6 sm:p-6 sm:pt-8">
                <h1 className="font-display text-2xl font-bold leading-[1.12] tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.65)] sm:text-[1.65rem] sm:leading-tight">
                  {question.title}
                </h1>
              </div>
            </div>

            <div className="bg-zinc-100 px-5 py-6 text-zinc-950">
              <p className="text-center text-[15px] font-semibold leading-snug text-zinc-900">
                What&apos;s your view on this question?
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleVote("yes")}
                  disabled={
                    submittingVote ||
                    voteChoice === "yes" ||
                    (voteChoice === "no" && !canChangeVote)
                  }
                  className={`min-h-[52px] rounded-xl px-3 text-[15px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/25 disabled:cursor-not-allowed disabled:opacity-55 ${
                    voteChoice === "yes"
                      ? "bg-zinc-900 text-white shadow-inner"
                      : "bg-zinc-300 text-zinc-900 hover:bg-zinc-200"
                  }`}
                >
                  {submittingVote
                    ? "Wait…"
                    : voteChoice === "yes"
                    ? voteLabels?.yesChosen ?? "You chose"
                    : voteLabels?.yes ?? "Yes"}
                </button>
                <button
                  type="button"
                  onClick={() => handleVote("no")}
                  disabled={
                    submittingVote ||
                    voteChoice === "no" ||
                    (voteChoice === "yes" && !canChangeVote)
                  }
                  className={`min-h-[52px] rounded-xl px-3 text-[15px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/25 disabled:cursor-not-allowed disabled:opacity-55 ${
                    voteChoice === "no"
                      ? "bg-zinc-900 text-white shadow-inner"
                      : "bg-zinc-300 text-zinc-900 hover:bg-zinc-200"
                  }`}
                >
                  {submittingVote
                    ? "Wait…"
                    : voteChoice === "no"
                    ? voteLabels?.noChosen ?? "You chose"
                    : voteLabels?.no ?? "No"}
                </button>
              </div>

              <div className="mt-5 rounded-xl bg-zinc-200/80 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-zinc-700">
                  <span>
                    {totalVotes} vote{totalVotes === 1 ? "" : "s"} · You:{" "}
                    {voteChoice ? voteChoice.toUpperCase() : "—"}
                  </span>
                  <span className="tabular-nums">
                    Yes {yesPercent}% · No {noPercent}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-400/60">
                  <div
                    className="h-full rounded-full bg-zinc-900 transition-[width]"
                    style={{ width: `${yesPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6 border-t border-zinc-800 bg-zinc-950/95 px-5 py-6 sm:px-6">
              <p className="text-sm leading-relaxed text-zinc-400 sm:text-[15px]">
                {question.description}
              </p>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Share
                </p>
                <SocialShareButtons
                  title={question.title}
                  text={`Vote on: ${question.title}`}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-sm border border-zinc-800 bg-zinc-950/40 p-5">
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-300">
                    Arguments For
                  </h2>
                  <ul className="space-y-3 text-sm leading-6 text-zinc-200">
                    {question.argumentsFor.map((argument, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-zinc-100" />
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
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-zinc-400" />
                        <span>{argument}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {(question.yesMeans || question.noMeans) && (
                <div className="rounded-sm border border-zinc-700 bg-zinc-950/50 p-5">
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

              <details className="group rounded-xl border border-zinc-800 bg-zinc-900/40">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-900/60 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-2">
                    Optional demographics (for insights)
                    <span className="text-zinc-500 group-open:rotate-180">▼</span>
                  </span>
                </summary>
                <div className="border-t border-zinc-800 px-4 pb-4 pt-2">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-zinc-500">
                        Gender
                      </label>
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
              </details>

              {message && (
                <div className="rounded-sm border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-300">
                  {message}
                </div>
              )}

              {voteChoice && (
                <div className="rounded-sm border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-300">
                  One vote per device. You may switch once (Yes ↔ No); after that
                  your choice is final. Vote changes are counted for insights (time
                  since your first vote).
                </div>
              )}

              <QuestionDiscussion mode="open" questionId={questionId} />
            </div>
          </article>
        )}
      </section>
    </main>
  );
}