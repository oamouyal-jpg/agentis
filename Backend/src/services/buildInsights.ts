import { dataStore } from "../store/store";
import { generateInsightNarrative } from "./generateInsightNarrative";

function formatDurationMs(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}

export async function buildInsightsForSpace(spaceId: number) {
  const questions = await dataStore.getQuestions(spaceId);
  const submissions = await dataStore.getSubmissions(spaceId);
  const voteEvents = await dataStore.getVoteEvents(spaceId);
  const voteFlips = await dataStore.listVoteFlipEvents(spaceId);

  const enriched = questions.map((q) => {
    const totalVotes = q.votesYes + q.votesNo;
    const yesRatio = totalVotes > 0 ? q.votesYes / totalVotes : 0;
    const noRatio = totalVotes > 0 ? q.votesNo / totalVotes : 0;
    const controversyScore =
      totalVotes > 0 ? 1 - Math.abs(0.5 - yesRatio) * 2 : 0;

    return {
      ...q,
      totalVotes,
      yesRatio,
      noRatio,
      controversyScore,
    };
  });

  const topQuestions = [...enriched]
    .sort((a, b) => b.totalVotes - a.totalVotes)
    .slice(0, 5);

  const mostControversial = [...enriched]
    .filter((q) => q.totalVotes > 0)
    .sort((a, b) => {
      if (b.controversyScore !== a.controversyScore) {
        return b.controversyScore - a.controversyScore;
      }
      return b.totalVotes - a.totalVotes;
    })
    .slice(0, 5);

  const strongestConsensus = [...enriched]
    .filter((q) => q.totalVotes > 0)
    .sort((a, b) => {
      const aConsensus = Math.max(a.yesRatio, a.noRatio);
      const bConsensus = Math.max(b.yesRatio, b.noRatio);

      if (bConsensus !== aConsensus) {
        return bConsensus - aConsensus;
      }

      return b.totalVotes - a.totalVotes;
    })
    .slice(0, 5)
    .map((q) => ({
      ...q,
      consensusSide: q.yesRatio >= q.noRatio ? "yes" : "no",
      consensusStrength: Math.max(q.yesRatio, q.noRatio),
    }));

  const clusterMap = new Map<
    string,
    {
      clusterId: string;
      title: string;
      questionCount: number;
      totalVotes: number;
      titles: string[];
    }
  >();

  for (const q of enriched) {
    const clusterId = q.clusterId || "unclustered";
    const clusterTitle = q.clusterId || "Unclustered";

    if (!clusterMap.has(clusterId)) {
      clusterMap.set(clusterId, {
        clusterId,
        title: clusterTitle,
        questionCount: 0,
        totalVotes: 0,
        titles: [],
      });
    }

    const entry = clusterMap.get(clusterId)!;
    entry.questionCount += 1;
    entry.totalVotes += q.totalVotes;
    entry.titles.push(q.title);
  }

  const clusterSummary = [...clusterMap.values()]
    .sort((a, b) => b.totalVotes - a.totalVotes)
    .map((cluster) => ({
      clusterId: cluster.clusterId,
      title: cluster.title,
      questionCount: cluster.questionCount,
      totalVotes: cluster.totalVotes,
      titles: cluster.titles,
    }));

  const totalYes = enriched.reduce((s, q) => s + q.votesYes, 0);
  const totalNo = enriched.reduce((s, q) => s + q.votesNo, 0);

  const overview = {
    totalQuestions: questions.length,
    totalVotes: enriched.reduce((sum, q) => sum + q.totalVotes, 0),
    totalSubmissions: submissions.length,
    totalYes,
    totalNo,
  };

  const titleByQuestionId = new Map(questions.map((q) => [q.id, q.title]));
  const totalMindChanges = voteFlips.length;
  const yesToNo = voteFlips.filter(
    (f) => f.fromVote === "yes" && f.toVote === "no"
  ).length;
  const noToYes = voteFlips.filter(
    (f) => f.fromVote === "no" && f.toVote === "yes"
  ).length;

  const msSorted = voteFlips
    .map((f) => f.msSinceFirstVote)
    .filter((ms) => typeof ms === "number" && ms >= 0)
    .sort((a, b) => a - b);
  const medianMsToFlip =
    msSorted.length === 0
      ? null
      : msSorted[Math.floor(msSorted.length / 2)] ?? null;

  const flipsByQuestion = new Map<number, number>();
  for (const f of voteFlips) {
    flipsByQuestion.set(
      f.questionId,
      (flipsByQuestion.get(f.questionId) ?? 0) + 1
    );
  }

  const topMindChangeQuestions = [...flipsByQuestion.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([questionId, flipCount]) => ({
      questionId,
      title: titleByQuestionId.get(questionId) ?? `Question ${questionId}`,
      flipCount,
    }));

  const mindChanges = {
    total: totalMindChanges,
    yesToNo,
    noToYes,
    shareOfVoters:
      overview.totalVotes > 0 ? totalMindChanges / overview.totalVotes : 0,
    medianMsToFlip,
    medianTimeLabel:
      medianMsToFlip === null ? null : formatDurationMs(medianMsToFlip),
    topQuestions: topMindChangeQuestions,
  };

  const countBy = (values: Array<string | undefined>) => {
    const m: Record<string, number> = {};
    for (const v of values) {
      const key = (v ?? "").trim();
      if (!key) continue;
      m[key] = (m[key] ?? 0) + 1;
    }
    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, count }));
  };

  const demographics = {
    gender: countBy(voteEvents.map((v) => v.demographics?.gender)),
    ageRange: countBy(voteEvents.map((v) => v.demographics?.ageRange)),
    country: countBy(voteEvents.map((v) => v.demographics?.country)).slice(0, 20),
    town: countBy(voteEvents.map((v) => v.demographics?.town)).slice(0, 20),
    totalEvents: voteEvents.length,
  };

  const narrative = await generateInsightNarrative({
    overview,
    topQuestions: topQuestions.map((q) => ({
      id: q.id,
      title: q.title,
      description: q.description,
      yesVotes: q.votesYes,
      noVotes: q.votesNo,
      clusterId: q.clusterId,
    })),
    mostControversial: mostControversial.map((q) => ({
      id: q.id,
      title: q.title,
      description: q.description,
      yesVotes: q.votesYes,
      noVotes: q.votesNo,
      clusterId: q.clusterId,
    })),
    strongestConsensus: strongestConsensus.map((q) => ({
      id: q.id,
      title: q.title,
      description: q.description,
      yesVotes: q.votesYes,
      noVotes: q.votesNo,
      clusterId: q.clusterId,
    })),
    clusterSummary: clusterSummary.map((c) => ({
      clusterId: c.clusterId,
      title: c.title,
      questionCount: c.questionCount,
      totalVotes: c.totalVotes,
    })),
    mindChanges: {
      total: mindChanges.total,
      shareOfVoters: mindChanges.shareOfVoters,
      yesToNo: mindChanges.yesToNo,
      noToYes: mindChanges.noToYes,
      medianTimeLabel: mindChanges.medianTimeLabel,
      topQuestionTitle: mindChanges.topQuestions[0]?.title,
    },
  });

  return {
    overview,
    topQuestions,
    mostControversial,
    strongestConsensus,
    clusterSummary,
    demographics,
    mindChanges,
    narrative,
  };
}
