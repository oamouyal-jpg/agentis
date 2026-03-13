import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
  res.json([
    {
      id: 1,
      title: "Should councils fast-track worker housing approvals?",
      votes: 142
    },
    {
      id: 2,
      title: "Should short term rentals be limited in housing crisis regions?",
      votes: 89
    }
  ]);
});

export default router;