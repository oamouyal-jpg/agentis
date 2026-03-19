import { generateJson } from "./ai.service";

export type GeneratedQuestion = {
  title: string;
  description: string;
  argumentsFor: string[];
  argumentsAgainst: string[];
};

function cleanText(input: string): string {
  return String(input || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForDetection(input: string): string {
  return cleanText(input)
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/[^\w\s']/g, " ");
}

function uniq(items: string[]): string[] {
  return Array.from(new Set(items.map((x) => cleanText(x)).filter(Boolean)));
}

function pickThemeFromText(theme: string, submissionTexts: string[]): string {
  const combined = normalizeForDetection([theme, ...submissionTexts].join(" "));

  if (
    combined.includes("rent") ||
    combined.includes("housing") ||
    combined.includes("house") ||
    combined.includes("home") ||
    combined.includes("afford") ||
    combined.includes("mortgage")
  ) {
    return "housing affordability";
  }

  if (
    combined.includes("cost of living") ||
    combined.includes("expensive") ||
    combined.includes("prices") ||
    combined.includes("groceries") ||
    combined.includes("electricity") ||
    combined.includes("bills") ||
    combined.includes("inflation")
  ) {
    return "cost of living pressures";
  }

  if (
    combined.includes("traffic") ||
    combined.includes("road") ||
    combined.includes("parking") ||
    combined.includes("transport") ||
    combined.includes("bus") ||
    combined.includes("train")
  ) {
    return "transport and traffic conditions";
  }

  if (
    combined.includes("crime") ||
    combined.includes("safety") ||
    combined.includes("police") ||
    combined.includes("violence") ||
    combined.includes("theft")
  ) {
    return "community safety";
  }

  if (
    combined.includes("health") ||
    combined.includes("hospital") ||
    combined.includes("doctor") ||
    combined.includes("mental health")
  ) {
    return "access to health services";
  }

  if (
    combined.includes("school") ||
    combined.includes("education") ||
    combined.includes("teacher") ||
    combined.includes("students")
  ) {
    return "education quality and access";
  }

  return cleanText(theme) || "a recurring public concern";
}

function fallbackQuestion(theme: string, submissionTexts: string[] = []): GeneratedQuestion {
  const refinedTheme = pickThemeFromText(theme, submissionTexts);

  return {
    title: `Should more be done to address ${refinedTheme}?`,
    description: `This question was generated from multiple similar public submissions relating to ${refinedTheme}.`,
    argumentsFor: [
      `Supporters may argue ${refinedTheme} is affecting everyday life and deserves stronger action.`,
      "Addressing the issue could improve public wellbeing, stability, or confidence."
    ],
    argumentsAgainst: [
      "Others may argue public resources should be directed to more urgent priorities.",
      "Some may believe existing policies or services already address the issue sufficiently."
    ]
  };
}

function sanitizeTitle(title: string, theme: string, submissionTexts: string[]): string {
  const cleaned = cleanText(title)
    .replace(/^question:\s*/i, "")
    .replace(/^title:\s*/i, "");

  if (!cleaned) {
    return fallbackQuestion(theme, submissionTexts).title;
  }

  const withQuestionMark = cleaned.endsWith("?") ? cleaned : `${cleaned}?`;

  if (withQuestionMark.length < 15) {
    return fallbackQuestion(theme, submissionTexts).title;
  }

  return withQuestionMark;
}

function sanitizeDescription(description: string, theme: string, submissionTexts: string[]): string {
  const cleaned = cleanText(description)
    .replace(/^description:\s*/i, "");

  if (!cleaned || cleaned.length < 20) {
    return fallbackQuestion(theme, submissionTexts).description;
  }

  return cleaned;
}

function sanitizeArguments(
  items: unknown,
  fallbackItems: string[]
): string[] {
  if (!Array.isArray(items)) {
    return fallbackItems;
  }

  const cleaned = uniq(
    items
      .map((x) => cleanText(String(x)))
      .filter((x) => x.length >= 12)
  ).slice(0, 2);

  if (cleaned.length < 2) {
    return fallbackItems;
  }

  return cleaned;
}

export async function generateQuestionFromTheme(
  theme: string,
  submissionTexts: string[] = []
): Promise<GeneratedQuestion> {
  const safeTheme = cleanText(theme);
  const safeTexts = submissionTexts.map(cleanText).filter(Boolean).slice(0, 10);
  const fallback = fallbackQuestion(safeTheme, safeTexts);

  const systemPrompt = `
You generate neutral civic voting questions from clustered public submissions.

Return valid JSON with exactly this shape:
{
  "title": string,
  "description": string,
  "argumentsFor": string[],
  "argumentsAgainst": string[]
}

Hard rules:
- Write in plain, natural English.
- The title must be a SINGLE neutral public question suitable for voting.
- The title must be specific, not robotic, and must end with a question mark.
- Avoid weak phrases like "this issue", "this concern", or "something should be done" unless absolutely necessary.
- Base the question on the common thread across the submissions, not on one submission alone.
- The description should be 1 sentence explaining what shared issue the question represents.
- argumentsFor must contain exactly 2 concise points.
- argumentsAgainst must contain exactly 2 concise points.
- Do not include markdown.
- Do not include numbering.
- Do not include any keys other than title, description, argumentsFor, argumentsAgainst.
- Keep the output balanced and neutral.
`.trim();

  const userPrompt = `
Common theme:
${safeTheme || "General public concern"}

Submission texts:
${safeTexts.length ? safeTexts.map((t, i) => `${i + 1}. ${t}`).join("\n") : "No submissions provided."}

Write one strong civic voting question based on the shared issue.
Make it feel human, specific, and useful for public voting.
`.trim();

  const aiResult = await generateJson<GeneratedQuestion>(systemPrompt, userPrompt);

  if (!aiResult) {
    return fallback;
  }

  return {
    title: sanitizeTitle(aiResult.title, safeTheme, safeTexts),
    description: sanitizeDescription(aiResult.description, safeTheme, safeTexts),
    argumentsFor: sanitizeArguments(aiResult.argumentsFor, fallback.argumentsFor),
    argumentsAgainst: sanitizeArguments(aiResult.argumentsAgainst, fallback.argumentsAgainst)
  };
}