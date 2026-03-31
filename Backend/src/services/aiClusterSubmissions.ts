import OpenAI from "openai";

type Submission = {
  id: number | string;
  text: string;
  createdAt?: string;
};

export type AICluster = {
  clusterId: string;
  title: string;
  summary: string;
  submissionIds: Array<number | string>;
};

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

function fallbackClusterSubmissions(submissions: Submission[]): AICluster[] {
  const buckets: Record<string, Submission[]> = {};

  for (const submission of submissions) {
    const text = submission.text.toLowerCase();

    let key = "general";

    if (
      text.includes("rent") ||
      text.includes("housing") ||
      text.includes("house") ||
      text.includes("home") ||
      text.includes("landlord")
    ) {
      key = "housing";
    } else if (
      text.includes("cost") ||
      text.includes("price") ||
      text.includes("inflation") ||
      text.includes("groceries") ||
      text.includes("bills")
    ) {
      key = "cost-of-living";
    } else if (
      text.includes("lonely") ||
      text.includes("loneliness") ||
      text.includes("alone") ||
      text.includes("isolat")
    ) {
      key = "loneliness";
    } else if (
      text.includes("health") ||
      text.includes("mental") ||
      text.includes("doctor") ||
      text.includes("hospital")
    ) {
      key = "health";
    } else if (
      text.includes("school") ||
      text.includes("education") ||
      text.includes("children") ||
      text.includes("youth")
    ) {
      key = "education";
    }

    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(submission);
  }

  return Object.entries(buckets).map(([key, group]) => {
    const titles: Record<string, { title: string; summary: string }> = {
      housing: {
        title: "Housing and affordability",
        summary:
          "Concerns related to housing access, affordability, rent, and shelter security.",
      },
      "cost-of-living": {
        title: "Cost of living",
        summary:
          "Concerns related to rising prices, household pressure, and everyday affordability.",
      },
      loneliness: {
        title: "Loneliness and social isolation",
        summary:
          "Concerns related to disconnection, loneliness, and weakening social bonds.",
      },
      health: {
        title: "Health and wellbeing",
        summary:
          "Concerns related to healthcare access, mental health, and wellbeing.",
      },
      education: {
        title: "Education and young people",
        summary:
          "Concerns related to schools, children, youth development, and future opportunity.",
      },
      general: {
        title: "General public concern",
        summary:
          "A broader cluster of concerns that does not yet fit a dominant theme.",
      },
    };

    return {
      clusterId: `cluster-${key}`,
      title: titles[key]?.title || "General public concern",
      summary: titles[key]?.summary || "A broader cluster of public concern.",
      submissionIds: group.map((s) => s.id),
    };
  });
}

export async function aiClusterSubmissions(
  submissions: Submission[]
): Promise<AICluster[]> {
  if (submissions.length === 0) return [];
  if (!client) return fallbackClusterSubmissions(submissions);

  try {
    const compactSubmissions = submissions.map((s) => ({
      id: s.id,
      text: s.text,
    }));

    const prompt = `
You are clustering public civic submissions for a platform called Agentis.

Your job:
Group submissions by MEANING, not just repeated keywords.

Rules:
- Create between 1 and 7 clusters total depending on the input
- Merge semantically similar submissions even if different words are used
- Do not create near-duplicate clusters
- Titles must be short, neutral, and civic in tone
- Summaries must be one sentence, neutral, and clear
- Every submission id must appear in exactly one cluster
- Return only clusters that actually contain submissions
- Keep clusterId slug-like, stable-looking, and lowercase with hyphens
- Return valid JSON matching the schema

Submissions:
${JSON.stringify(compactSubmissions, null, 2)}
`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "agentis_clusters",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              clusters: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    clusterId: { type: "string" },
                    title: { type: "string" },
                    summary: { type: "string" },
                    submissionIds: {
                      type: "array",
                      items: {
                        anyOf: [{ type: "string" }, { type: "number" }],
                      },
                    },
                  },
                  required: ["clusterId", "title", "summary", "submissionIds"],
                },
              },
            },
            required: ["clusters"],
          },
        },
      },
    });

    const raw = response.output_text?.trim();
    if (!raw) return fallbackClusterSubmissions(submissions);

    const parsed = JSON.parse(raw) as { clusters: AICluster[] };
    const clusters = Array.isArray(parsed.clusters) ? parsed.clusters : [];

    if (!clusters.length) {
      return fallbackClusterSubmissions(submissions);
    }

    const knownIds = new Set(submissions.map((s) => String(s.id)));
    const assignedIds = new Set<string>();

    const cleaned = clusters
      .map((cluster) => {
        const ids = Array.from(
          new Set(
            (cluster.submissionIds || [])
              .map((id) => String(id))
              .filter((id) => knownIds.has(id))
          )
        );

        ids.forEach((id) => assignedIds.add(id));

        const safeTitle = (cluster.title || "General public concern").trim();
        const safeId =
          (cluster.clusterId || `cluster-${slugify(safeTitle)}`).trim() ||
          `cluster-${slugify(safeTitle)}`;

        return {
          clusterId: safeId.startsWith("cluster-") ? safeId : `cluster-${safeId}`,
          title: safeTitle,
          summary:
            (cluster.summary || "A broader cluster of public concern.").trim(),
          submissionIds: ids,
        };
      })
      .filter((cluster) => cluster.submissionIds.length > 0);

    const unassigned = submissions
      .filter((s) => !assignedIds.has(String(s.id)))
      .map((s) => s.id);

    if (unassigned.length > 0) {
      cleaned.push({
        clusterId: "cluster-general",
        title: "General public concern",
        summary:
          "A broader cluster of concerns that does not yet fit a dominant theme.",
        submissionIds: unassigned,
      });
    }

    return cleaned;
  } catch (error) {
    console.error("aiClusterSubmissions failed, using fallback:", error);
    return fallbackClusterSubmissions(submissions);
  }
}