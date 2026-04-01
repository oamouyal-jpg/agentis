"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "../../lib/apiBase";

type Question = {
  id: number;
  title: string;
  description: string;
  argumentsFor: string[];
  argumentsAgainst: string[];
  clusterId: string;
  sourceSubmissionIds: number[];
  votesYes: number;
  votesNo: number;
  createdAt: number;
};

export default function QuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [questionId, setQuestionId] = useState<number | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function resolveParams() {
      const resolved = await params;
      setQuestionId(Number(resolved.id));
    }

    resolveParams();
  }, [params]);

  useEffect(() => {
    if (questionId === null) return;

    async function loadQuestion() {
      try {
        const res = await fetch(`${API_BASE}/questions/${questionId}`);
        if (!res.ok) {
          throw new Error("Failed to load question");
        }

        const data = await res.json();
        setQuestion(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load question");
      }
    }

    loadQuestion();
  }, [questionId]);

  async function handleVote(vote: "yes" | "no") {
    if (!question) return;

    try {
      const res = await fetch(`${API_BASE}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionId: question.id,
          vote,
        }),
      });

      if (!res.ok) {
        throw new Error("Vote failed");
      }

      const data = await res.json();
      setQuestion(data.question);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vote failed");
    }
  }

  if (error) {
    return (
      <main style={{ padding: 20 }}>
        <p style={{ color: "red" }}>{error}</p>
      </main>
    );
  }

  if (!question) {
    return (
      <main style={{ padding: 20 }}>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 20 }}>
      <h1>{question.title}</h1>
      <p>{question.description}</p>

      <p>
        Yes: {question.votesYes} | No: {question.votesNo}
      </p>

      <button onClick={() => handleVote("yes")} style={{ marginRight: 10 }}>
        Vote Yes
      </button>
      <button onClick={() => handleVote("no")}>Vote No</button>

      <h3>For</h3>
      <ul>
        {question.argumentsFor.map((arg, i) => (
          <li key={i}>{arg}</li>
        ))}
      </ul>

      <h3>Against</h3>
      <ul>
        {question.argumentsAgainst.map((arg, i) => (
          <li key={i}>{arg}</li>
        ))}
      </ul>
    </main>
  );
}