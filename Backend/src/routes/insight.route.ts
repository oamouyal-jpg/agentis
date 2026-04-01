import express from "express";
import { dataStore } from "../store/store";

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    await dataStore.ensureDefaultSpace();
    const open = await dataStore.getSpaceBySlug("open");
    const questions = open ? await dataStore.getQuestions(open.id) : [];
    const now = Date.now();

    const consensus = questions
      .filter((q) => {
        const totalVotes = (q.votesYes || 0) + (q.votesNo || 0);
        if (totalVotes === 0) return false;
        const agreement = Math.max(q.votesYes || 0, q.votesNo || 0) / totalVotes;
        return totalVotes > 20 && agreement > 0.75;
      })
      .map((q) => {
        const totalVotes = (q.votesYes || 0) + (q.votesNo || 0);
        const agreement = Math.max(q.votesYes || 0, q.votesNo || 0) / totalVotes;
        return {
          type: "consensus" as const,
          question: q,
          score: agreement,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const divided = questions
      .filter((q) => {
        const totalVotes = (q.votesYes || 0) + (q.votesNo || 0);
        if (totalVotes === 0) return false;
        const agreement = Math.max(q.votesYes || 0, q.votesNo || 0) / totalVotes;
        return totalVotes > 20 && agreement >= 0.4 && agreement <= 0.6;
      })
      .map((q) => {
        const totalVotes = (q.votesYes || 0) + (q.votesNo || 0);
        const agreement = Math.max(q.votesYes || 0, q.votesNo || 0) / totalVotes;
        return {
          type: "divided" as const,
          question: q,
          score: Math.abs(0.5 - agreement),
        };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 5);

    const emerging = questions
      .filter((q) => {
        const totalVotes = (q.votesYes || 0) + (q.votesNo || 0);
        const createdAt = q.createdAt || now;
        const isRecent = now - createdAt < 1000 * 60 * 60 * 48;
        return isRecent && totalVotes > 5;
      })
      .map((q) => ({
        type: "emerging" as const,
        question: q,
        score: (q.votesYes || 0) + (q.votesNo || 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    res.json({
      consensus,
      divided,
      emerging,
    });
  } catch (err) {
    console.error("INSIGHTS ERROR:", err);
    res.status(500).json({
      error: "Failed to generate insights",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
