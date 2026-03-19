import { Cluster, Question, Store, Submission } from "../types";

console.log("🔥 STORE FILE LOADED");

export const store: Store = {
  submissions: [],
  clusters: [],
  questions: [],
  counters: {
    submissionId: 1,
    questionId: 1
  }
};

export function createSubmission(text: string): Submission {
  const submission: Submission = {
    id: store.counters.submissionId++,
    text: text.trim(),
    createdAt: Date.now()
  };

  store.submissions.push(submission);
  return submission;
}

export function replaceClusters(clusters: Cluster[]): void {
  store.clusters = clusters;
}

export function replaceQuestions(questions: Question[]): void {
  store.questions = questions;
}

export function resetGeneratedData(): void {
  store.clusters = [];
  store.questions = [];
  store.counters.questionId = 1;
}