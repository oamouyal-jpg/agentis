import { Response, Router } from "express";
import { dataStore } from "../../store/store";
import { runClusteringForSpace } from "./runClusteringForSpace";

const router = Router({ mergeParams: true });

function spaceId(res: Response): number {
  const id = (res.locals as { spaceId?: number }).spaceId;
  if (typeof id !== "number") {
    throw new Error("Missing space context");
  }
  return id;
}

router.get("/stats", async (_req, res) => {
  const sid = spaceId(res);
  const questions = await dataStore.getQuestions(sid);
  const submissions = await dataStore.getSubmissions(sid);

  const totalVotes = questions.reduce(
    (sum, q) => sum + (q.votesYes || 0) + (q.votesNo || 0),
    0
  );

  res.json({
    totalSubmissions: submissions.length,
    pendingSubmissions: submissions.filter((s) => !s.clustered).length,
    clusteredSubmissions: submissions.filter((s) => s.clustered).length,
    totalQuestions: questions.length,
    totalVotes,
  });
});

/** Optional manual / ops trigger; clustering also runs automatically after each submission. */
router.post("/cluster", async (_req, res) => {
  try {
    const sid = spaceId(res);
    const result = await runClusteringForSpace(sid);
    return res.json(result);
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

router.post("/consolidate-questions", async (_req, res) => {
  try {
    const sid = spaceId(res);
    const questions = await dataStore.getQuestions(sid);

    if (!questions.length) {
      return res.json({
        ok: true,
        message: "No questions found",
        groupsFound: 0,
        questionsRemoved: 0,
        totalQuestions: 0,
      });
    }

    const groups = new Map<string, typeof questions>();

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

      await dataStore.updateQuestion(sid, keeper.id, {
        votesYes: mergedVotesYes,
        votesNo: mergedVotesNo,
        sourceSubmissionIds: mergedSubmissionIds,
      });

      for (const duplicate of duplicates) {
        const deleted = await dataStore.deleteQuestion(sid, duplicate.id);
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
      totalQuestions: (await dataStore.getQuestions(sid)).length,
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
