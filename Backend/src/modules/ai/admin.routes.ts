import { Router } from "express";
import { dataStore } from "../../store/store";
import { aiClusterSubmissions } from "./aiClusterSubmissions";
import { assignSubmissionsToExistingQuestions } from "./assignSubmissionsToExistingQuestions";
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
    const questions = dataStore.getQuestions();

    const pendingSubmissions = submissions.filter((s: any) => !s.clustered);

    if (pendingSubmissions.length === 0) {
      return res.json({
        ok: true,
        message: "No new submissions to cluster",
        mergedIntoExisting: 0,
        clustersCreated: 0,
        questionsCreated: 0,
        totalQuestions: questions.length,
      });
    }

    const assignments = await assignSubmissionsToExistingQuestions(
      pendingSubmissions.map((s: any) => ({
        id: s.id,
        text: s.text,
      })),
      questions.map((q: any) => ({
        id: q.id,
        title: q.title,
        description: q.description,
        clusterId: q.clusterId,
      }))
    );

    let mergedIntoExisting = 0;

    for (const assignment of assignments) {
      if (!assignment.matched || !assignment.clusterId) {
        continue;
      }

      const submissionId = Number(assignment.submissionId);

      dataStore.markSubmissionClustered(submissionId, assignment.clusterId);
      dataStore.addSubmissionIdsToQuestionByClusterId(assignment.clusterId, [
        submissionId,
      ]);
      mergedIntoExisting++;
    }

    const refreshedSubmissions = dataStore.getSubmissions();
    const unassignedSubmissions = refreshedSubmissions.filter(
      (s: any) => !s.clustered
    );

    if (unassignedSubmissions.length === 0) {
      return res.json({
        ok: true,
        message: "All pending submissions were merged into existing questions",
        mergedIntoExisting,
        clustersCreated: 0,
        questionsCreated: 0,
        totalQuestions: dataStore.getQuestions().length,
        assignments,
      });
    }

    const clusters = await aiClusterSubmissions(unassignedSubmissions);
    let questionsCreated = 0;
    const createdQuestions: any[] = [];

    for (const cluster of clusters) {
      const clusterSubmissions = unassignedSubmissions.filter((submission: any) =>
        cluster.submissionIds.includes(submission.id)
      );

      if (!clusterSubmissions.length) {
        continue;
      }

      const existingQuestion = dataStore.getQuestionByClusterId(cluster.clusterId);

      if (existingQuestion) {
        const ids = clusterSubmissions.map((s: any) => s.id);

        dataStore.addSubmissionIdsToQuestionByClusterId(cluster.clusterId, ids);

        for (const submission of clusterSubmissions) {
          dataStore.markSubmissionClustered(submission.id, cluster.clusterId);
        }

        mergedIntoExisting += ids.length;
        continue;
      }

      const submissionTexts = clusterSubmissions
        .map((submission: any) => submission.text || "")
        .filter(Boolean);

      const generated = await generateQuestionFromTheme(
        cluster.title || "general public concern",
        submissionTexts
      );

      const createdQuestion = dataStore.addQuestion({
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
        clusterId: cluster.clusterId,
        sourceSubmissionIds: clusterSubmissions.map((s: any) => s.id),
      });

      for (const submission of clusterSubmissions) {
        dataStore.markSubmissionClustered(submission.id, cluster.clusterId);
      }

      createdQuestions.push(createdQuestion);
      questionsCreated++;
    }

    return res.json({
      ok: true,
      message: "Clustering completed",
      mergedIntoExisting,
      clustersCreated: clusters.length,
      questionsCreated,
      totalQuestions: dataStore.getQuestions().length,
      assignments,
      clusters,
      questions: createdQuestions,
    });
  } catch (error) {
    console.error("Cluster route failed:", error);

    return res.status(500).json({
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

router.post("/consolidate-questions", (_req, res) => {
  try {
    const questions = dataStore.getQuestions();

    if (!questions.length) {
      return res.json({
        ok: true,
        message: "No questions found",
        groupsFound: 0,
        questionsRemoved: 0,
        totalQuestions: 0,
      });
    }

    const groups = new Map<string, any[]>();

    for (const question of questions) {
      const key = question.clusterId || `question-${question.id}`;

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key)!.push(question);
    }

    const duplicateGroups = [...groups.entries()].filter(
      ([, items]) => items.length > 1
    );

    if (!duplicateGroups.length) {
      return res.json({
        ok: true,
        message: "No duplicate question groups found",
        groupsFound: 0,
        questionsRemoved: 0,
        totalQuestions: questions.length,
      });
    }

    const consolidationReport: Array<{
      clusterId: string;
      keptQuestionId: number;
      removedQuestionIds: number[];
      mergedVotesYes: number;
      mergedVotesNo: number;
      mergedSubmissionIds: number[];
    }> = [];

    let questionsRemoved = 0;

    for (const [clusterId, items] of duplicateGroups) {
      const sorted = [...items].sort((a, b) => a.id - b.id);
      const keeper = sorted[0];
      const duplicates = sorted.slice(1);

      const mergedVotesYes = sorted.reduce(
        (sum, q) => sum + (q.votesYes || 0),
        0
      );
      const mergedVotesNo = sorted.reduce(
        (sum, q) => sum + (q.votesNo || 0),
        0
      );
      const mergedSubmissionIds = Array.from(
        new Set(sorted.flatMap((q) => q.sourceSubmissionIds || []))
      );

      dataStore.updateQuestion(keeper.id, {
        votesYes: mergedVotesYes,
        votesNo: mergedVotesNo,
        sourceSubmissionIds: mergedSubmissionIds,
      });

      for (const duplicate of duplicates) {
        const deleted = dataStore.deleteQuestion(duplicate.id);
        if (deleted) {
          questionsRemoved++;
        }
      }

      consolidationReport.push({
        clusterId,
        keptQuestionId: keeper.id,
        removedQuestionIds: duplicates.map((q) => q.id),
        mergedVotesYes,
        mergedVotesNo,
        mergedSubmissionIds,
      });
    }

    return res.json({
      ok: true,
      message: "Question consolidation completed",
      groupsFound: duplicateGroups.length,
      questionsRemoved,
      totalQuestions: dataStore.getQuestions().length,
      consolidated: consolidationReport,
    });
  } catch (error) {
    console.error("Consolidate questions route failed:", error);

    return res.status(500).json({
      ok: false,
      error: "Question consolidation failed",
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