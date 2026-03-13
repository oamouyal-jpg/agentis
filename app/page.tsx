"use client";

import { useEffect, useState } from "react";

type Question = {
  id: number;
  title: string;
  votes: number;
};

export default function HomePage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:4000/questions")
      .then((res) => res.json())
      .then((data) => {
        setQuestions(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to fetch questions:", error);
        setLoading(false);
      });
  }, []);

  return (
    <main style={{ padding: "40px", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ fontSize: "32px", marginBottom: "24px" }}>
        Agentis Active Questions
      </h1>

      {loading ? (
        <p>Loading questions...</p>
      ) : (
        <div style={{ display: "grid", gap: "16px" }}>
          {questions.map((question) => (
            <div
              key={question.id}
              style={{
                border: "1px solid #ccc",
                borderRadius: "12px",
                padding: "20px",
              }}
            >
              <h2 style={{ fontSize: "22px", marginBottom: "8px" }}>
                {question.title}
              </h2>
              <p>Votes: {question.votes}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}