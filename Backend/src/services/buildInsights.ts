import { dataStore } from "../store/store";
import { generateInsightNarrative } from "./generateInsightNarrative";

export async function buildInsightsForSpace(spaceId: number) {
  const questions = await dataStore.getQuestions(spaceId);
  const submissions = await dataStore.getSubmissions(spaceId);

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
  });

  return {
    overview,
    topQuestions,
    mostControversial,
    strongestConsensus,
    clusterSummary,
    narrative,
  };
}
