type Submission = {
  id: number;
  text: string;
  clustered?: boolean;
  clusterId?: string;
};

type Cluster = {
  id: string;
  submissions: Submission[];
  keywords: string[];
};

const STOP_WORDS = new Set([
  "the",
  "is",
  "and",
  "a",
  "to",
  "of",
  "in",
  "it",
  "that",
  "this",
  "for",
  "on",
  "with",
  "as",
  "are",
  "was",
  "be",
  "by",
  "an",
  "too",
  "more",
  "done",
  "should",
  "becoming"
]);

const SYNONYM_GROUPS: Record<string, string[]> = {
  housing: ["housing", "house", "home", "homes", "rent", "rental", "renting", "afford", "affordable", "unaffordable"],
  cost: ["cost", "costs", "expensive", "price", "prices", "living"],
  safety: ["crime", "safety", "police", "violence"],
  transport: ["traffic", "road", "roads", "parking", "transport", "bus", "buses"],
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalize(word: string): string {
  for (const [root, variants] of Object.entries(SYNONYM_GROUPS)) {
    if (variants.includes(word)) return root;
  }
  return word;
}

function extractKeywords(text: string): string[] {
  return Array.from(
    new Set(
      normalize(text)
        .split(" ")
        .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
        .map(canonicalize)
    )
  );
}

function similarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);

  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...a, ...b]).size;

  if (union === 0) return 0;
  return intersection / union;
}

export function clusterSubmissions(submissions: Submission[]): Cluster[] {
  const clusters: Cluster[] = [];

  for (const sub of submissions) {
    const keywords = extractKeywords(sub.text);

    let bestCluster: Cluster | null = null;
    let bestScore = 0;

    for (const cluster of clusters) {
      const score = similarity(keywords, cluster.keywords);

      if (score > bestScore) {
        bestScore = score;
        bestCluster = cluster;
      }
    }

    if (bestCluster && bestScore >= 0.2) {
      bestCluster.submissions.push(sub);
      bestCluster.keywords = Array.from(
        new Set([...bestCluster.keywords, ...keywords])
      );
    } else {
      clusters.push({
        id: `cluster-${clusters.length + 1}`,
        submissions: [sub],
        keywords,
      });
    }
  }

  return clusters;
}