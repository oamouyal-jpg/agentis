import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

import express, { Request, Response } from "express";
import cors from "cors";

console.log("ENV PATH:", path.resolve(__dirname, "../.env"));
console.log("OPENAI KEY LOADED:", !!process.env.OPENAI_API_KEY);

import adminRoutes from "./modules/ai/admin.routes";
import { dataStore } from "./store/store";

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

app.get("/", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    message: "Agentis backend running",
  });
});

app.get("/questions", (_req: Request, res: Response) => {
  res.json(dataStore.getQuestions());
});

app.get("/submissions", (_req: Request, res: Response) => {
  res.json(dataStore.getSubmissions());
});

app.get("/insights", (_req: Request, res: Response) => {
  try {
    const questions = dataStore.getQuestions();

    const enriched = questions.map((q) => {
      const totalVotes = q.votesYes + q.votesNo;
      const yesRatio = totalVotes > 0 ? q.votesYes / totalVotes : 0;
      const noRatio = totalVotes > 0 ? q.votesNo / totalVotes : 0;
      const controversyScore =
        totalVotes > 0 ? 1 - Math.abs(0.5 - yesRatio) * 2 : 0;

      return {
        ...q,
        totalVotes,
        yesRatio,
        noRatio,
        controversyScore,
      };
    });

    const topQuestions = [...enriched]
      .sort((a, b) => b.totalVotes - a.totalVotes)
      .slice(0, 5);

    const mostControversial = [...enriched]
      .filter((q) => q.totalVotes > 0)
      .sort((a, b) => {
        if (b.controversyScore !== a.controversyScore) {
          return b.controversyScore - a.controversyScore;
        }
        return b.totalVotes - a.totalVotes;
      })
      .slice(0, 5);

    const strongestConsensus = [...enriched]
      .filter((q) => q.totalVotes > 0)
      .sort((a, b) => {
        const aConsensus = Math.max(a.yesRatio, a.noRatio);
        const bConsensus = Math.max(b.yesRatio, b.noRatio);

        if (bConsensus !== aConsensus) {
          return bConsensus - aConsensus;
        }

        return b.totalVotes - a.totalVotes;
      })
      .slice(0, 5)
      .map((q) => ({
        ...q,
        consensusSide: q.yesRatio >= q.noRatio ? "yes" : "no",
        consensusStrength: Math.max(q.yesRatio, q.noRatio),
      }));

    const clusterMap = new Map<
      string,
      {
        clusterId: string;
        questionCount: number;
        totalVotes: number;
        titles: string[];
      }
    >();

    for (const q of enriched) {
      const existing = clusterMap.get(q.clusterId);

      if (existing) {
        existing.questionCount += 1;
        existing.totalVotes += q.totalVotes;
        existing.titles.push(q.title);
      } else {
        clusterMap.set(q.clusterId, {
          clusterId: q.clusterId,
          questionCount: 1,
          totalVotes: q.totalVotes,
          titles: [q.title],
        });
      }
    }

    const clusterSummary = [...clusterMap.values()].sort(
      (a, b) => b.totalVotes - a.totalVotes
    );

    const overview = enriched.reduce(
      (acc, q) => {
        acc.totalQuestions += 1;
        acc.totalVotes += q.totalVotes;
        acc.totalYes += q.votesYes;
        acc.totalNo += q.votesNo;
        return acc;
      },
      {
        totalQuestions: 0,
        totalVotes: 0,
        totalYes: 0,
        totalNo: 0,
      }
    );

    res.json({
      ok: true,
      overview,
      topQuestions,
      mostControversial,
      strongestConsensus,
      clusterSummary,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "Failed to generate insights",
      details: String(error),
    });
  }
});

app.post("/submit", (req: Request, res: Response) => {
  try {
    const { text } = req.body as { text?: string };

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        ok: false,
        error: "Submission text is required",
      });
    }

    const submission = dataStore.addSubmission(text.trim());

    return res.json({
      ok: true,
      submission,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "Failed to submit",
      details: String(error),
    });
  }
});

app.post("/vote", (req: Request, res: Response) => {
  try {
    const { questionId, vote } = req.body as {
      questionId?: number;
      vote?: "yes" | "no";
    };

    if (typeof questionId !== "number") {
      return res.status(400).json({
        ok: false,
        error: "questionId is required",
      });
    }

    if (vote !== "yes" && vote !== "no") {
      return res.status(400).json({
        ok: false,
        error: 'vote must be "yes" or "no"',
      });
    }

    const updatedQuestion = dataStore.voteOnQuestion(questionId, vote);

    if (!updatedQuestion) {
      return res.status(404).json({
        ok: false,
        error: "Question not found",
      });
    }

    return res.json({
      ok: true,
      question: updatedQuestion,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "Voting failed",
      details: String(error),
    });
  }
});

app.use("/admin", adminRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});