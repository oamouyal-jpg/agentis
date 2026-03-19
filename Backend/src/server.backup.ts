import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { dataStore } from "./store/store";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/questions", (_req, res) => {
  res.json(dataStore.getQuestions());
});

app.get("/questions/:id", (req, res) => {
  const id = Number(req.params.id);
  const question = dataStore.getQuestionById(id);

  if (!question) {
    res.status(404).json({ error: "Question not found" });
    return;
  }

  res.json(question);
});

app.post("/vote", (req, res) => {
  const { questionId, vote } = req.body as {
    questionId?: number;
    vote?: "yes" | "no";
  };

  if (!questionId || (vote !== "yes" && vote !== "no")) {
    res.status(400).json({ error: "Invalid vote payload" });
    return;
  }

  const updated = dataStore.vote(questionId, vote);

  if (!updated) {
    res.status(404).json({ error: "Question not found" });
    return;
  }

  res.json(updated);
});

app.post("/submit", (req, res) => {
  const { text } = req.body as { text?: string };

  if (!text || !text.trim()) {
    res.status(400).json({ error: "Submission text is required" });
    return;
  }

  const submission = dataStore.addSubmission(text.trim());
  res.status(201).json(submission);
});

app.get("/admin/stats", (_req, res) => {
  const questions = dataStore.getQuestions();
  const submissions = dataStore.getSubmissions();
  const totalVotes = questions.reduce((sum, q) => sum + q.votesYes + q.votesNo, 0);

  res.json({
    totalSubmissions: submissions.length,
    pendingSubmissions: submissions.filter((s) => s.status === "pending").length,
    clusteredSubmissions: submissions.filter((s) => s.status === "clustered").length,
    totalQuestions: questions.length,
    totalVotes,
  });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});