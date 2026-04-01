import OpenAI from "openai";

type Submission = {
  id: number | string;
  text: string;
  createdAt?: number;
  clustered?: boolean;
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
    const text = String(submission.text || "").toLowerCase();

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

  const labels: Record<string, { title: string; summary: string }> = {
    housing: {
      title: "Housing and affordability",
      summary:
        "Concerns related to housing access, affordability, rent, and housing stability.",
    },
    "cost-of-living": {
      title: "Cost of living",
      summary:
        "Concerns related to rising prices, bills, and household financial pressure.",
    },
    loneliness: {
      title: "Loneliness and social isolation",
      summary:
        "Concerns related to loneliness, isolation, and weakening social connection.",
    },
    health: {
      title: "Health and wellbeing",
      summary:
        "Concerns related to healthcare access, mental health, and personal wellbeing.",
    },
    education: {
      title: "Education and young people",
      summary:
        "Concerns related to schools, youth development, and future opportunity.",
    },
    general: {
      title: "General public concern",
      summary:
        "A broader cluster of public concerns that does not yet fit a dominant theme.",
    },
  };

  return Object.entries(buckets).map(([key, group]) => ({
    clusterId: `cluster-${key}`,
    title: labels[key]?.title || "General public concern",
    summary:
      labels[key]?.summary ||
      "A broader cluster of public concerns that does not yet fit a dominant theme.",
    submissionIds: group.map((s) => s.id),
  }));
}

export async function aiClusterSubmissions(
  submissions: Submission[]
): Promise<AICluster[]> {
  if (!submissions.length) return [];
  if (!client) return fallbackClusterSubmissions(submissions);

  try {
    const compactSubmissions = submissions.map((s) => ({
      id: s.id,
      text: s.text,
    }));

    const prompt = `
You are clustering civic submissions for a platform called Agentis.

Group submissions by meaning, not just repeated keywords.

Rules:
- Create between 1 and 7 clusters
- Merge semantically similar submissions even if wording differs
- Do not create duplicate or overlapping clusters
- Titles must be short, neutral, and civic in tone
- Summaries must be one clear neutral sentence
- Every submission id must appear in exactly one cluster
- Return only valid JSON matching the requested schema

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

    if (!raw) {
      return fallbackClusterSubmissions(submissions);
    }

    const parsed = JSON.parse(raw) as { clusters?: AICluster[] };
    const clusters = Array.isArray(parsed.clusters) ? parsed.clusters : [];

    if (!clusters.length) {
      return fallbackClusterSubmissions(submissions);
    }

    const knownIds = new Set(submissions.map((s) => String(s.id)));
    const assignedIds = new Set<string>();

    const cleaned = clusters
      .map((cluster) => {
        const safeTitle = String(cluster.title || "General public concern").trim();
        const safeSummary = String(
          cluster.summary ||
            "A broader cluster of public concerns that does not yet fit a dominant theme."
        ).trim();

        const ids = Array.from(
          new Set(
            (cluster.submissionIds || [])
              .map((id) => String(id))
              .filter((id) => knownIds.has(id))
          )
        ).map((id) => {
          const original = submissions.find((s) => String(s.id) === id);
          return original ? original.id : id;
        });

        ids.forEach((id) => assignedIds.add(String(id)));

        const rawId =
          String(cluster.clusterId || "").trim() || `cluster-${slugify(safeTitle)}`;

        const clusterId = rawId.startsWith("cluster-")
          ? rawId
          : `cluster-${slugify(rawId)}`;

        return {
          clusterId,
          title: safeTitle,
          summary: safeSummary,
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
          "A broader cluster of public concerns that does not yet fit a dominant theme.",
        submissionIds: unassigned,
      });
    }

    return cleaned;
  } catch (error) {
    console.error("aiClusterSubmissions failed, using fallback:", error);
    return fallbackClusterSubmissions(submissions);
  }
}