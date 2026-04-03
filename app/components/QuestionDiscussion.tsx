"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../lib/apiBase";
import { getOrCreateDeviceId } from "../../lib/deviceId";
import { spaceFetch } from "../../lib/spaceApi";

export type QuestionDiscussionProps = {
  mode: "space" | "open";
  slug?: string;
  questionId: number;
};

type Comment = {
  id: number;
  body: string;
  authorName?: string;
  createdAt?: number;
  likeCount?: number;
  liked?: boolean;
};

function avatarLetter(name: string | undefined): string {
  const s = name?.trim();
  if (!s) return "?";
  const ch = s[0];
  return ch && ch !== "@" ? ch.toUpperCase() : "?";
}

function shortTime(ts: number | undefined): string {
  if (ts == null || Number.isNaN(ts)) return "";
  const d = new Date(ts);
  const now = Date.now();
  const diff = Math.max(0, now - d.getTime());
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function deviceHeaders(): HeadersInit {
  const id = typeof window !== "undefined" ? getOrCreateDeviceId() : "";
  return id ? { "X-Space-Device": id } : {};
}

export function QuestionDiscussion({
  mode,
  slug,
  questionId,
}: QuestionDiscussionProps) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const [hint, setHint] = useState("");
  const [composerActive, setComposerActive] = useState(false);
  const [likingId, setLikingId] = useState<number | null>(null);
  const [likeError, setLikeError] = useState("");

  const commentsPath = `/questions/${questionId}/comments`;

  const load = useCallback(async () => {
    if (!Number.isFinite(questionId)) return;
    try {
      setLoading(true);
      setLoadError("");
      const res =
        mode === "space" && slug
          ? await spaceFetch(slug, commentsPath, { cache: "no-store" })
          : await fetch(
              `${API_BASE}/spaces/open/questions/${questionId}/comments`,
              { cache: "no-store", headers: deviceHeaders() }
            );
      const text = await res.text();
      if (!res.ok) throw new Error(text || "Failed to load comments");
      const data = JSON.parse(text) as unknown;
      setComments(Array.isArray(data) ? (data as Comment[]) : []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load comments");
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [mode, slug, questionId]);

  useEffect(() => {
    if (!open) return;
    load();
  }, [open, load]);

  async function toggleLike(commentId: number) {
    if (likingId != null) return;
    setLikeError("");
    try {
      setLikingId(commentId);
      const likePath = `/questions/${questionId}/comments/${commentId}/like`;
      const res =
        mode === "space" && slug
          ? await spaceFetch(slug, likePath, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            })
          : await fetch(
              `${API_BASE}/spaces/open/questions/${questionId}/comments/${commentId}/like`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...deviceHeaders(),
                },
                body: "{}",
              }
            );
      const respText = await res.text();
      if (!res.ok) {
        try {
          const j = JSON.parse(respText) as { error?: string };
          throw new Error(j.error || respText || "Could not update like");
        } catch (err) {
          if (err instanceof Error && err.message !== respText) throw err;
          throw new Error(respText || "Could not update like");
        }
      }
      const data = JSON.parse(respText) as { likes: number; liked: boolean };
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, likeCount: data.likes, liked: data.liked }
            : c
        )
      );
    } catch (e) {
      setLikeError(e instanceof Error ? e.message : "Could not update like");
      window.setTimeout(() => setLikeError(""), 4000);
    } finally {
      setLikingId(null);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || posting) return;
    try {
      setPosting(true);
      setPostError("");
      setHint("");
      const payload = JSON.stringify({
        body: text,
        authorName: authorName.trim() || undefined,
      });
      const res =
        mode === "space" && slug
          ? await spaceFetch(slug, commentsPath, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: payload,
            })
          : await fetch(
              `${API_BASE}/spaces/open/questions/${questionId}/comments`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: payload,
              }
            );
      const respText = await res.text();
      if (!res.ok) {
        try {
          const j = JSON.parse(respText) as { error?: string };
          throw new Error(j.error || respText || "Failed to post");
        } catch (err) {
          if (err instanceof Error && err.message !== respText) throw err;
          throw new Error(respText || "Failed to post");
        }
      }
      const data = JSON.parse(respText) as { comment?: Comment };
      if (data?.comment) {
        const nc = data.comment;
        setComments((prev) => [
          ...prev,
          {
            ...nc,
            likeCount: nc.likeCount ?? 0,
            liked: nc.liked ?? false,
          },
        ]);
      } else {
        await load();
      }
      setBody("");
      setAuthorName("");
      setComposerActive(false);
      setHint("Posted.");
      window.setTimeout(() => setHint(""), 2500);
    } catch (e) {
      setPostError(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setPosting(false);
    }
  }

  const headerSuffix =
    !open ? "" : loading ? " · …" : ` · ${comments.length}`;

  return (
    <div className="mt-6 border-t border-zinc-800/90">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm text-zinc-300 transition hover:text-zinc-100"
        aria-expanded={open}
      >
        <span className="font-medium">
          Comments
          {headerSuffix}
        </span>
        <span
          className="text-zinc-500 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
          aria-hidden
        >
          ▼
        </span>
      </button>

      {open ? (
        <div className="border-t border-zinc-800/80 pb-2">
          {loading ? (
            <p className="py-4 text-xs text-zinc-500">Loading…</p>
          ) : loadError && comments.length === 0 ? (
            <p className="py-3 text-xs text-red-300/90">{loadError}</p>
          ) : null}

          {likeError ? (
            <p className="py-1 text-[11px] text-red-300/90">{likeError}</p>
          ) : null}

          {!loading && composerActive ? (
            <form onSubmit={handleSubmit} className="border-b border-zinc-800/80 py-3">
              <div className="flex gap-2">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-medium text-zinc-200"
                  aria-hidden
                >
                  {avatarLetter(authorName || undefined)}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Name (optional)"
                    maxLength={80}
                    className="w-full rounded border border-zinc-700/80 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-600"
                  />
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={2}
                    maxLength={4000}
                    placeholder="Add a comment…"
                    autoFocus
                    className="w-full resize-y rounded border border-zinc-700/80 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="submit"
                      disabled={posting || !body.trim()}
                      className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-950 disabled:opacity-50"
                    >
                      {posting ? "…" : "Comment"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setComposerActive(false);
                        setBody("");
                        setPostError("");
                      }}
                      className="text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      Cancel
                    </button>
                    <span className="text-[10px] text-zinc-600">{body.length}/4000</span>
                  </div>
                </div>
              </div>
              {postError ? (
                <p className="mt-2 text-xs text-red-300/90">{postError}</p>
              ) : null}
              {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
            </form>
          ) : (
            !loading && (
              <button
                type="button"
                onClick={() => setComposerActive(true)}
                className="mb-2 w-full rounded border border-dashed border-zinc-700/80 bg-zinc-950/40 py-2 text-left text-xs text-zinc-500 hover:border-zinc-600 hover:text-zinc-400"
              >
                Add a comment…
              </button>
            )
          )}

          {!loading && comments.length > 0 ? (
            <ul className="divide-y divide-zinc-800/80">
              {comments.map((c) => {
                const label = c.authorName?.trim() || "Anonymous";
                const likes = c.likeCount ?? 0;
                const isLiked = Boolean(c.liked);
                return (
                  <li key={c.id} className="flex gap-2 py-2.5 pr-1">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-medium text-zinc-300"
                      aria-hidden
                    >
                      {avatarLetter(c.authorName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                        <span className="text-xs font-medium text-zinc-200">{label}</span>
                        {c.createdAt ? (
                          <time
                            className="text-[10px] text-zinc-600"
                            dateTime={new Date(c.createdAt).toISOString()}
                          >
                            {shortTime(c.createdAt)}
                          </time>
                        ) : null}
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-snug text-zinc-400">
                        {c.body}
                      </p>
                      <div className="mt-1">
                        <button
                          type="button"
                          disabled={likingId === c.id}
                          onClick={() => toggleLike(c.id)}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition disabled:opacity-50 ${
                            isLiked
                              ? "bg-sky-950/50 text-sky-300 hover:bg-sky-950/70"
                              : "bg-zinc-800/60 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                          }`}
                          aria-pressed={isLiked}
                          aria-label={isLiked ? "Unlike" : "Like"}
                        >
                          <span className="text-[13px] leading-none" aria-hidden>
                            👍
                          </span>
                          <span>{likes}</span>
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {!loading && loadError && comments.length > 0 ? (
            <p className="py-2 text-xs text-red-300/90">{loadError}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
