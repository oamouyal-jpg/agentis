import { dataStore } from "../../store/store";
import { refreshSpaceTrending } from "../../services/trending.service";
import { aiClusterSubmissions } from "./aiClusterSubmissions";
import { assignSubmissionsToExistingQuestions } from "./assignSubmissionsToExistingQuestions";
import { generateQuestionFromTheme } from "./question.service";

export type ClusteringResult = Record<string, unknown>;

/** Full clustering pipeline for one space (same logic as POST /admin/cluster). */
export async function runClusteringForSpace(
  spaceId: number
): Promise<ClusteringResult> {
  try {
  const submissions = await dataStore.getSubmissions(spaceId);
  const questions = await dataStore.getQuestions(spaceId);

  const pendingSubmissions = submissions.filter((s) => !s.clustered);

  if (pendingSubmissions.length === 0) {
    return {
      ok: true,
      message: "No new submissions to cluster",
      mergedIntoExisting: 0,
      clustersCreated: 0,
      questionsCreated: 0,
      totalQuestions: questions.length,
    };
  }

  const assignments = await assignSubmissionsToExistingQuestions(
    pendingSubmissions.map((s) => ({
      id: s.id,
      text: s.text,
    })),
    questions.map((q) => ({
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

    await dataStore.markSubmissionClustered(spaceId, submissionId, assignment.clusterId);
    await dataStore.addSubmissionIdsToQuestionByClusterId(
      spaceId,
      assignment.clusterId,
      [submissionId]
    );
    mergedIntoExisting++;
  }

  const refreshedSubmissions = await dataStore.getSubmissions(spaceId);
  const unassignedSubmissions = refreshedSubmissions.filter((s) => !s.clustered);

  if (unassignedSubmissions.length === 0) {
    return {
      ok: true,
      message: "All pending submissions were merged into existing questions",
      mergedIntoExisting,
      clustersCreated: 0,
      questionsCreated: 0,
      totalQuestions: (await dataStore.getQuestions(spaceId)).length,
      assignments,
    };
  }

  const clusters = await aiClusterSubmissions(unassignedSubmissions);
  let questionsCreated = 0;
  const createdQuestions: unknown[] = [];

  for (const cluster of clusters) {
    const clusterSubmissions = unassignedSubmissions.filter((submission) =>
      cluster.submissionIds.includes(submission.id)
    );

    if (!clusterSubmissions.length) {
      continue;
    }

    const existingQuestion = await dataStore.getQuestionByClusterId(
      spaceId,
      cluster.clusterId
    );

    if (existingQuestion) {
      const ids = clusterSubmissions.map((s) => s.id);

      await dataStore.addSubmissionIdsToQuestionByClusterId(
        spaceId,
        cluster.clusterId,
        ids
      );

      for (const submission of clusterSubmissions) {
        await dataStore.markSubmissionClustered(
          spaceId,
          submission.id,
          cluster.clusterId
        );
      }

      mergedIntoExisting += ids.length;
      continue;
    }

    const submissionTexts = clusterSubmissions
      .map((submission) => submission.text || "")
      .filter(Boolean);

    const generated = await generateQuestionFromTheme(
      cluster.title || "general public concern",
      submissionTexts
    );

    const createdQuestion = await dataStore.addQuestion(spaceId, {
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
      sourceSubmissionIds: clusterSubmissions.map((s) => s.id),
    });

    for (const submission of clusterSubmissions) {
      await dataStore.markSubmissionClustered(
        spaceId,
        submission.id,
        cluster.clusterId
      );
    }

    createdQuestions.push(createdQuestion);
    questionsCreated++;
  }

  return {
    ok: true,
    message: "Clustering completed",
    mergedIntoExisting,
    clustersCreated: clusters.length,
    questionsCreated,
    totalQuestions: (await dataStore.getQuestions(spaceId)).length,
    assignments,
    clusters,
    questions: createdQuestions,
  };
  } finally {
    try {
      await refreshSpaceTrending(spaceId);
    } catch (e) {
      console.error(`[trending] refresh failed for space ${spaceId}:`, e);
    }
  }
}

const clusteringInFlight = new Map<number, boolean>();

/**
 * After a new submission, run clustering in the background (response is not blocked).
 * Per-space serialization; if submissions arrive during a run, a follow-up pass is scheduled.
 */
export function scheduleClusteringAfterSubmission(spaceId: number): void {
  if (clusteringInFlight.get(spaceId)) {
    return;
  }

  clusteringInFlight.set(spaceId, true);

  setImmediate(() => {
    void (async () => {
      try {
        await runClusteringForSpace(spaceId);
      } catch (error) {
        console.error(`[clustering] space ${spaceId} failed:`, error);
      } finally {
        clusteringInFlight.delete(spaceId);
        try {
          const subs = await dataStore.getSubmissions(spaceId);
          const stillPending = subs.filter((s) => !s.clustered);
          if (stillPending.length > 0) {
            scheduleClusteringAfterSubmission(spaceId);
          }
        } catch (e) {
          console.error(`[clustering] space ${spaceId} follow-up check failed:`, e);
        }
      }
    })();
  });
}
