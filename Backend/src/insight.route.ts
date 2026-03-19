import express from "express";
import { generateInsights } from "../services/insight.service";
import { questions } from "../data/store"; // adjust if needed

const router = express.Router();

router.get("/", (req, res) => {
  try {
    const insights = generateInsights(questions);
    res.json(insights);
  } catch (err) {
    res.status(500).json({
      error: "Failed to generate insights",
    });
  }
});

export default router;