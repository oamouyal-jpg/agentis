import { dataStore } from "../store/store";
import type { Question, Submission } from "../store/store";

/** Tunable — see docs/hot-emerging-topics-spec.md */
export const TRENDING_DEFAULTS = {
  windowMs: 7 * 24 * 60 * 60 * 1000,
  h48Ms: 48 * 60 * 60 * 1000,
  /** Minimum submission-linked entries in window to qualify as “hot” */
  nMinHot: 3,
  /** Minimum entries in window for “emerging” */
  nMinEmerge: 2,
  /** New leader must score ≥ current × R to take over */
  replaceRatio: 1.35,
  /** Max emerging rows after hot */
  kEmerging: 4,
  /** Force reconsider hot after this age (ms) */
  maxHotAgeMs: 14 * 24 * 60 * 60 * 1000,
  velocityCap: 3,
  risingFastVelocity: 1.5,
  risingFastMinEntries48h: 2,
  w1: 2,
  w2: 0.5,
  w3: 1,
} as const;

export type QuestionTrendMetrics = {
  questionId: number;
  clusterId: string;
  score: number;
  entriesInWindow: number;
  entriesLast48h: number;
  entriesPrev48h: number;
  commentsInWindow: number;
  velocityRatio: number;
  risingFast: boolean;
};

export type TrendingSnapshot = {
  hot: {
    question: Question;
    metrics: QuestionTrendMetrics;
  } | null;
  emerging: Array<{
    question: Question;
    metrics: QuestionTrendMetrics;
  }>;
  /** True if persisted hot pointer was updated */
  hotUpdated: boolean;
  /** Short note for logs / admin */
  reason?: string;
};

function nowMs(): number {
  return Date.now();
}

function subTime(s: Submission): number | undefined {
  return typeof s.createdAt === "number" ? s.createdAt : undefined;
}

/** Missing timestamp: treat as in-window so legacy rows still qualify */
function inWindow(
  t: number | undefined,
  end: number,
  windowMs: number
): boolean {
  if (t === undefined || t === 0) return true;
  return t >= end - windowMs;
}

function inRange(
  t: number | undefined,
  start: number,
  end: number
): boolean {
  if (t === undefined || t === 0) return true;
  return t >= start && t < end;
}

function computeMetricsForQuestion(
  q: Question,
  submissionById: Map<number, Submission>,
  commentsByQuestion: Map<number, number>,
  end: number,
  cfg: typeof TRENDING_DEFAULTS
): QuestionTrendMetrics {
  const ids = q.sourceSubmissionIds || [];
  let entriesInWindow = 0;
  let entriesLast48h = 0;
  let entriesPrev48h = 0;

  for (const id of ids) {
    const s = submissionById.get(id);
    if (!s) continue;
    const t = subTime(s);
    if (inWindow(t, end, cfg.windowMs)) entriesInWindow += 1;
    if (inRange(t, end - cfg.h48Ms, end)) entriesLast48h += 1;
    if (inRange(t, end - 2 * cfg.h48Ms, end - cfg.h48Ms)) entriesPrev48h += 1;
  }

  const rawVel =
    entriesLast48h / Math.max(1, entriesPrev48h);
  const velocityRatio = Math.min(cfg.velocityCap, rawVel);

  const commentsInWindow = commentsByQuestion.get(q.id) ?? 0;

  const score =
    cfg.w1 * Math.log(1 + entriesInWindow) +
    cfg.w2 * commentsInWindow +
    cfg.w3 * velocityRatio;

  const risingFast =
    rawVel >= cfg.risingFastVelocity &&
    entriesLast48h >= cfg.risingFastMinEntries48h;

  return {
    questionId: q.id,
    clusterId: q.clusterId,
    score,
    entriesInWindow,
    entriesLast48h,
    entriesPrev48h,
    commentsInWindow,
    velocityRatio,
    risingFast,
  };
}

function passesHotBar(m: QuestionTrendMetrics, cfg: typeof TRENDING_DEFAULTS): boolean {
  return m.entriesInWindow >= cfg.nMinHot;
}

function passesEmergeBar(m: QuestionTrendMetrics, cfg: typeof TRENDING_DEFAULTS): boolean {
  return m.entriesInWindow >= cfg.nMinEmerge;
}

function hasRecentMomentum(
  m: QuestionTrendMetrics,
  cfg: typeof TRENDING_DEFAULTS
): boolean {
  return (
    m.entriesLast48h >= 1 ||
    m.velocityRatio >= 1.2 ||
    m.entriesInWindow >= cfg.nMinHot + 2
  );
}

/**
 * Recompute scores, apply hot replacement rules, persist, return snapshot.
 */
export async function refreshSpaceTrending(
  spaceId: number,
  cfg: typeof TRENDING_DEFAULTS = TRENDING_DEFAULTS
): Promise<TrendingSnapshot> {
  const end = nowMs();
  const [questions, submissions, allComments, state] = await Promise.all([
    dataStore.getQuestions(spaceId),
    dataStore.getSubmissions(spaceId),
    dataStore.listQuestionCommentsForSpace(spaceId),
    dataStore.getSpaceTrending(spaceId),
  ]);

  const submissionById = new Map(submissions.map((s) => [s.id, s]));

  const commentsByQuestion = new Map<number, number>();
  const winStart = end - cfg.windowMs;
  for (const c of allComments) {
    if (c.spaceId !== spaceId) continue;
    const t = c.createdAt ?? 0;
    if (t > 0 && t < winStart) continue;
    commentsByQuestion.set(
      c.questionId,
      (commentsByQuestion.get(c.questionId) ?? 0) + 1
    );
  }

  const metricsList: QuestionTrendMetrics[] = questions.map((q) =>
    computeMetricsForQuestion(q, submissionById, commentsByQuestion, end, cfg)
  );
  const metricsByQid = new Map(metricsList.map((m) => [m.questionId, m]));

  const ranked = [...questions].sort(
    (a, b) =>
      (metricsByQid.get(b.id)?.score ?? 0) - (metricsByQid.get(a.id)?.score ?? 0)
  );

  const best = ranked[0];
  const bestM = best ? metricsByQid.get(best.id) : undefined;

  let hotQuestionId = state?.hotQuestionId ?? null;
  let hotPromotedAt = state?.hotPromotedAt ?? null;
  let reason: string | undefined;
  let hotUpdated = false;

  const qById = new Map(questions.map((q) => [q.id, q]));

  const currentHot =
    hotQuestionId != null ? qById.get(hotQuestionId) : undefined;
  const currentM = currentHot
    ? metricsByQid.get(currentHot.id)
    : undefined;

  // Stale pointer (deleted question)
  if (hotQuestionId != null && !currentHot) {
    hotQuestionId = null;
    hotPromotedAt = null;
    hotUpdated = true;
    reason = "cleared_missing_question";
  }

  if (hotQuestionId == null) {
    if (best && bestM && passesHotBar(bestM, cfg)) {
      hotQuestionId = best.id;
      hotPromotedAt = end;
      hotUpdated = true;
      reason = reason ? `${reason};initial_hot` : "initial_hot";
    }
  } else if (currentHot && currentM && best && bestM) {
    const age = hotPromotedAt != null ? end - hotPromotedAt : 0;
    const forceMaxAge = age >= cfg.maxHotAgeMs;

    const challengerWins =
      best.id !== hotQuestionId &&
      passesHotBar(bestM, cfg) &&
      bestM.score >= currentM.score * cfg.replaceRatio &&
      hasRecentMomentum(bestM, cfg);

    const forced =
      forceMaxAge &&
      best.id !== hotQuestionId &&
      passesHotBar(bestM, cfg);

    if (challengerWins || forced) {
      hotQuestionId = best.id;
      hotPromotedAt = end;
      hotUpdated = true;
      reason = forced ? "max_age_replacement" : "score_margin_replacement";
    }
  }

  if (hotUpdated) {
    await dataStore.setSpaceTrending(spaceId, {
      hotQuestionId,
      hotPromotedAt,
    });
  }

  const hotQ =
    hotQuestionId != null ? qById.get(hotQuestionId) ?? null : null;
  const hotMetrics = hotQ ? metricsByQid.get(hotQ.id) : undefined;

  const emerging: TrendingSnapshot["emerging"] = [];
  for (const q of ranked) {
    if (hotQuestionId != null && q.id === hotQuestionId) continue;
    const m = metricsByQid.get(q.id);
    if (!m || !passesEmergeBar(m, cfg)) continue;
    emerging.push({ question: q, metrics: m });
    if (emerging.length >= cfg.kEmerging) break;
  }

  return {
    hot:
      hotQ && hotMetrics
        ? { question: hotQ, metrics: hotMetrics }
        : null,
    emerging,
    hotUpdated,
    reason,
  };
}

/** JSON body for `GET /spaces/:slug/trending` and legacy `GET /trending` (open space). */
export async function getTrendingApiPayload(spaceId: number) {
  const snapshot = await refreshSpaceTrending(spaceId);
  return {
    ok: true as const,
    hot: snapshot.hot
      ? {
          question: snapshot.hot.question,
          metrics: snapshot.hot.metrics,
        }
      : null,
    emerging: snapshot.emerging.map((e) => ({
      question: e.question,
      metrics: e.metrics,
    })),
    hotUpdated: snapshot.hotUpdated,
    reason: snapshot.reason,
  };
}
