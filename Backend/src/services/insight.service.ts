import type { Question } from "../store/store";

type Insight = {
  type: "consensus" | "divided" | "emerging";
  question: Question;
  score: number;
};

export function generateInsights(questions: Question[]) {
  const insights: Insight[] = [];
  const now = Date.now();

  for (const q of questions) {
    const totalVotes = q.votesYes + q.votesNo;
    if (totalVotes === 0) continue;

    const agreement = Math.max(q.votesYes, q.votesNo) / totalVotes;

    if (totalVotes > 20 && agreement > 0.75) {
      insights.push({
        type: "consensus",
        question: q,
        score: agreement,
      });
    }

    if (totalVotes > 20 && agreement >= 0.4 && agreement <= 0.6) {
      insights.push({
        type: "divided",
        question: q,
        score: Math.abs(0.5 - agreement),
      });
    }

    const createdAt = q.createdAt ?? now;
    const isRecent = now - createdAt < 1000 * 60 * 60 * 48;

    if (isRecent && totalVotes > 5) {
      insights.push({
        type: "emerging",
        question: q,
        score: totalVotes,
      });
    }
  }

  return {
    consensus: insights
      .filter((i) => i.type === "consensus")
      .sort((a, b) => b.score - a.score)
      .slice(0, 5),

    divided: insights
      .filter((i) => i.type === "divided")
      .sort((a, b) => a.score - b.score)
      .slice(0, 5),

    emerging: insights
      .filter((i) => i.type === "emerging")
      .sort((a, b) => b.score - a.score)
      .slice(0, 5),
  };
}