import { Router } from "express";
import { dataStore } from "../../store/store";
import { clusterSubmissions } from "./cluster.service";
import { generateQuestionFromTheme } from "./question.service";

const router = Router();

router.get("/stats", (_req, res) => {
  const questions = dataStore.getQuestions();
  const submissions = dataStore.getSubmissions();

  const totalVotes = questions.reduce(
    (sum, q: any) => sum + (q.votesYes || 0) + (q.votesNo || 0),
    0
  );

  res.json({
    totalSubmissions: submissions.length,
    pendingSubmissions: submissions.filter((s: any) => !s.clustered).length,
    clusteredSubmissions: submissions.filter((s: any) => s.clustered).length,
    totalQuestions: questions.length,
    totalVotes,
  });
});

router.post("/cluster", async (_req, res) => {
  try {
    const submissions = dataStore.getSubmissions();
    const clusters = clusterSubmissions(submissions);
    let questionsCreated = 0;

    for (const cluster of clusters) {
      const submissionTexts = cluster.submissions
        .map((submission: any) => submission.text || "")
        .filter(Boolean);

      const theme =
        Array.isArray(cluster.keywords) && cluster.keywords.length > 0
          ? cluster.keywords.slice(0, 3).join(" ")
          : "general public concern";

      const generated = await generateQuestionFromTheme(theme, submissionTexts);

      const safeTheme = theme
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-");

      const clusterId = `cluster-${safeTheme || "general-issue"}`;

      dataStore.addQuestion({
        title:
          generated?.title?.trim() ||
          "Should more be done to address this public concern?",
        description:
          generated?.description?.trim() ||
          "This question was generated from similar public submissions.",
        argumentsFor:
          Array.isArray(generated?.argumentsFor) && generated.argumentsFor.length > 0
            ? generated.argumentsFor
            : [
                "Supporters may argue this issue is recurring and affects daily life.",
                "Addressing it could improve community wellbeing.",
              ],
        argumentsAgainst:
          Array.isArray(generated?.argumentsAgainst) &&
          generated.argumentsAgainst.length > 0
            ? generated.argumentsAgainst
            : [
                "Others may argue resources should go to higher priorities.",
                "Some may believe current systems already address the issue.",
              ],
        clusterId,
        sourceSubmissionIds: cluster.submissions.map((s: any) => s.id),
      });

      for (const submission of cluster.submissions) {
        dataStore.markSubmissionClustered(submission.id, clusterId);
      }

      questionsCreated++;
    }

    res.json({
      ok: true,
      clustersCreated: clusters.length,
      questionsCreated,
    });
  } catch (error) {
    console.error("Cluster route failed:", error);

    res.status(500).json({
      ok: false,
      error: "Clustering failed",
      details:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
            }
          : String(error),
    });
  }
});

export default router;