import OpenAI from "openai";

type Submission = {
  id: number | string;
  text: string;
};

type ExistingQuestion = {
  id: number | string;
  title: string;
  description: string;
  clusterId: string;
};

export type SubmissionAssignment = {
  submissionId: number | string;
  matched: boolean;
  clusterId: string | null;
  reason: string;
};

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function normalize(text: string) {
  return String(text || "").toLowerCase();
}

function fallbackAssign(
  submissions: Submission[],
  questions: ExistingQuestion[]
): SubmissionAssignment[] {
  return submissions.map((submission) => {
    const text = normalize(submission.text);

    let matchedQuestion: ExistingQuestion | undefined;

    for (const question of questions) {
      const qText = `${question.title} ${question.description} ${question.clusterId}`.toLowerCase();

      const housing =
        (text.includes("rent") ||
          text.includes("housing") ||
          text.includes("house") ||
          text.includes("home") ||
          text.includes("landlord")) &&
        (qText.includes("rent") ||
          qText.includes("housing") ||
          qText.includes("house") ||
          qText.includes("home") ||
          qText.includes("landlord"));

      const cost =
        (text.includes("cost") ||
          text.includes("price") ||
          text.includes("inflation") ||
          text.includes("groceries") ||
          text.includes("bills")) &&
        (qText.includes("cost") ||
          qText.includes("price") ||
          qText.includes("inflation") ||
          qText.includes("groceries") ||
          qText.includes("bills"));

      const loneliness =
        (text.includes("lonely") ||
          text.includes("loneliness") ||
          text.includes("alone") ||
          text.includes("isolat")) &&
        (qText.includes("lonely") ||
          qText.includes("loneliness") ||
          qText.includes("alone") ||
          qText.includes("isolat"));

      const health =
        (text.includes("health") ||
          text.includes("mental") ||
          text.includes("doctor") ||
          text.includes("hospital")) &&
        (qText.includes("health") ||
          qText.includes("mental") ||
          qText.includes("doctor") ||
          qText.includes("hospital"));

      const education =
        (text.includes("school") ||
          text.includes("education") ||
          text.includes("children") ||
          text.includes("youth")) &&
        (qText.includes("school") ||
          qText.includes("education") ||
          qText.includes("children") ||
          qText.includes("youth"));

      if (housing || cost || loneliness || health || education) {
        matchedQuestion = question;
        break;
      }
    }

    if (matchedQuestion) {
      return {
        submissionId: submission.id,
        matched: true,
        clusterId: matchedQuestion.clusterId,
        reason: "Fallback semantic keyword match to existing question.",
      };
    }

    return {
      submissionId: submission.id,
      matched: false,
      clusterId: null,
      reason: "No fallback match found.",
    };
  });
}

export async function assignSubmissionsToExistingQuestions(
  submissions: Submission[],
  questions: ExistingQuestion[]
): Promise<SubmissionAssignment[]> {
  if (!submissions.length) return [];
  if (!questions.length) {
    return submissions.map((s) => ({
      submissionId: s.id,
      matched: false,
      clusterId: null,
      reason: "No existing questions available.",
    }));
  }

  if (!client) {
    return fallbackAssign(submissions, questions);
  }

  try {
    const compactSubmissions = submissions.map((s) => ({
      id: s.id,
      text: s.text,
    }));

    const compactQuestions = questions.map((q) => ({
      id: q.id,
      title: q.title,
      description: q.description,
      clusterId: q.clusterId,
    }));

    const prompt = `
You are helping assign new civic submissions to existing public questions in a platform called Agentis.

Task:
For each submission, decide whether it belongs to one of the existing questions.

Rules:
- Match by meaning, not just repeated words
- Only match when the submission clearly belongs to an existing question theme
- If uncertain, leave it unmatched
- Every submission must appear exactly once in the output
- Return only valid JSON matching the schema

New submissions:
${JSON.stringify(compactSubmissions, null, 2)}

Existing questions:
${JSON.stringify(compactQuestions, null, 2)}
`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "agentis_submission_assignments",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              assignments: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    submissionId: {
                      anyOf: [{ type: "string" }, { type: "number" }],
                    },
                    matched: { type: "boolean" },
                    clusterId: {
                      anyOf: [{ type: "string" }, { type: "null" }],
                    },
                    reason: { type: "string" },
                  },
                  required: ["submissionId", "matched", "clusterId", "reason"],
                },
              },
            },
            required: ["assignments"],
          },
        },
      },
    });

    const raw = response.output_text?.trim();

    if (!raw) {
      return fallbackAssign(submissions, questions);
    }

    const parsed = JSON.parse(raw) as { assignments?: SubmissionAssignment[] };
    const assignments = Array.isArray(parsed.assignments) ? parsed.assignments : [];

    if (!assignments.length) {
      return fallbackAssign(submissions, questions);
    }

    const validClusterIds = new Set(questions.map((q) => q.clusterId));
    const validSubmissionIds = new Set(submissions.map((s) => String(s.id)));

    const cleaned = submissions.map((submission) => {
      const found = assignments.find(
        (a) => String(a.submissionId) === String(submission.id)
      );

      if (!found) {
        return {
          submissionId: submission.id,
          matched: false,
          clusterId: null,
          reason: "Model did not return an assignment for this submission.",
        };
      }

      const clusterId =
        found.matched && found.clusterId && validClusterIds.has(found.clusterId)
          ? found.clusterId
          : null;

      return {
        submissionId: submission.id,
        matched: Boolean(clusterId),
        clusterId,
        reason: String(found.reason || "").trim() || "No reason provided.",
      };
    });

    return cleaned;
  } catch (error) {
    console.error(
      "assignSubmissionsToExistingQuestions failed, using fallback:",
      error
    );
    return fallbackAssign(submissions, questions);
  }
}