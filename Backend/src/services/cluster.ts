type Submission = {
  id: string;
  text: string;
};

type Cluster = {
  id: string;
  submissionIds: string[];
  keywords: string[];
};

type Question = {
  id: string;
  title: string;
  description: string;
  for: string[];
  against: string[];
  yes: number;
  no: number;
  clusterId: string;
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
  "or",
  "if",
  "but",
  "at",
  "from",
  "they",
  "we",
  "you",
  "i",
  "our",
  "their",
  "should",
  "could",
  "would",
  "can",
  "have",
  "has",
  "had",
  "not",
  "too",
  "very",
  "more",
  "less",
  "than",
  "into",
  "about"
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeywords(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function similarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);

  const intersection = [...setA].filter((word) => setB.has(word)).length;
  const union = new Set([...a, ...b]).size;

  if (union === 0) return 0;
  return intersection / union;
}

function buildClusterKeywords(
  submissionIds: string[],
  submissions: Submission[]
): string[] {
  const texts = submissions
    .filter((s) => submissionIds.includes(s.id))
    .map((s) => s.text);

  return unique(texts.flatMap((text) => extractKeywords(text)));
}

function keywordFrequency(
  cluster: Cluster,
  submissions: Submission[]
): string[] {
  const relevant = submissions.filter((s) => cluster.submissionIds.includes(s.id));
  const counts = new Map<string, number>();

  for (const submission of relevant) {
    const words = unique(extractKeywords(submission.text));
    for (const word of words) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);
}

function buildTitle(keywords: string[]): string {
  const top = keywords.slice(0, 3);

  if (top.length === 0) {
    return "Untitled civic question";
  }

  if (top.length === 1) {
    return `What should be done about ${top[0]}?`;
  }

  if (top.length === 2) {
    return `What should be done about ${top[0]} and ${top[1]}?`;
  }

  return `What should be done about ${top[0]}, ${top[1]} and ${top[2]}?`;
}

function buildDescription(cluster: Cluster, submissions: Submission[]): string {
  const relatedTexts = submissions
    .filter((s) => cluster.submissionIds.includes(s.id))
    .map((s) => s.text);

  if (relatedTexts.length === 0) {
    return "No description";
  }

  return relatedTexts.slice(0, 3).join(" | ");
}

export function clusterSubmissions(submissions: Submission[]): Cluster[] {
  const clusters: Cluster[] = [];

  for (const submission of submissions) {
    const keywords = extractKeywords(submission.text);

    let bestClusterIndex = -1;
    let bestScore = 0;

    for (let i = 0; i < clusters.length; i += 1) {
      const score = similarity(keywords, clusters[i].keywords);

      if (score > bestScore) {
        bestScore = score;
        bestClusterIndex = i;
      }
    }

    if (bestClusterIndex >= 0 && bestScore >= 0.3) {
      const existing = clusters[bestClusterIndex];
      existing.submissionIds.push(submission.id);
      existing.keywords = unique([...existing.keywords, ...keywords]);
    } else {
      clusters.push({
        id: `cluster-${clusters.length + 1}`,
        submissionIds: [submission.id],
        keywords
      });
    }
  }

  return clusters.map((cluster) => ({
    ...cluster,
    keywords: buildClusterKeywords(cluster.submissionIds, submissions)
  }));
}

export function generateQuestionsFromClusters(
  clusters: Cluster[],
  submissions: Submission[]
): Question[] {
  return clusters.map((cluster, index) => {
    const rankedKeywords = keywordFrequency(cluster, submissions);

    return {
      id: `question-${index + 1}`,
      title: buildTitle(rankedKeywords),
      description: buildDescription(cluster, submissions),
      for: ["Potential public benefit needs to be considered."],
      against: ["Costs and trade-offs need to be considered."],
      yes: 0,
      no: 0,
      clusterId: cluster.id
    };
  });
}