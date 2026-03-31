import OpenAI from "openai";

type Question = {
  id: string;
  title: string;
  description?: string;
  yesVotes: number;
  noVotes: number;
  clusterId?: string;
};

type InsightPayload = {
  overview: {
    totalQuestions: number;
    totalVotes: number;
    totalSubmissions?: number;
  };
  topQuestions: Question[];
  mostControversial: Question[];
  strongestConsensus: Question[];
  clusterSummary: Array<{
    clusterId: string;
    title: string;
    questionCount: number;
    totalVotes: number;
  }>;
};

const client =
  process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

function buildFallbackNarrative(data: InsightPayload) {
  const parts: string[] = [];

  parts.push(
    `Agentis is currently tracking ${data.overview.totalQuestions} active civic questions and ${data.overview.totalVotes} total votes.`
  );

  if (data.topQuestions.length > 0) {
    const top = data.topQuestions[0];
    parts.push(
      `The most engaged question right now is "${top.title}", suggesting this issue is attracting the strongest public attention.`
    );
  }

  if (data.mostControversial.length > 0) {
    const controversial = data.mostControversial[0];
    parts.push(
      `The most divided issue is "${controversial.title}", which indicates a fault line in public opinion rather than a settled view.`
    );
  }

  if (data.strongestConsensus.length > 0) {
    const consensus = data.strongestConsensus[0];
    parts.push(
      `The strongest consensus appears around "${consensus.title}", showing that some concerns are not only visible, but broadly aligned in one direction.`
    );
  }

  if (data.clusterSummary.length > 0) {
    const topCluster = [...data.clusterSummary].sort(
      (a, b) => b.totalVotes - a.totalVotes
    )[0];

    parts.push(
      `At the cluster level, "${topCluster.title}" is generating the strongest concentration of attention, which may point to an emerging civic priority.`
    );
  }

  parts.push(
    `Overall, the platform is beginning to show not just what people care about, but where collective concern is converging, fragmenting, and intensifying.`
  );

  return parts.join(" ");
}

export async function generateInsightNarrative(data: InsightPayload) {
  if (!client) {
    return buildFallbackNarrative(data);
  }

  try {
    const prompt = `
You are generating a civic intelligence summary for a platform called Agentis.

Your task:
Write a sharp, neutral, insightful narrative summary of the current public signal.

Rules:
- Be analytical, not dramatic
- Do not sound like marketing copy
- Do not invent facts
- Focus on emerging patterns, tensions, consensus, and public attention
- Keep it between 180 and 260 words
- Avoid bullet points
- Write in plain, intelligent language

Data:
${JSON.stringify(data, null, 2)}
`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
    });

    const text = response.output_text?.trim();

    if (!text) {
      return buildFallbackNarrative(data);
    }

    return text;
  } catch (error) {
    console.error("generateInsightNarrative failed:", error);
    return buildFallbackNarrative(data);
  }
}