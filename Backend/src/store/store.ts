import * as fs from "fs";
import * as path from "path";

export type Submission = {
  id: number;
  text: string;
  clustered?: boolean;
  clusterId?: string;
};

export type Question = {
  id: number;
  title: string;
  description: string;
  argumentsFor: string[];
  argumentsAgainst: string[];
  votesYes: number;
  votesNo: number;
  clusterId: string;
  sourceSubmissionIds: number[];
};

type PersistedData = {
  submissions: Submission[];
  questions: Question[];
  nextSubmissionId: number;
  nextQuestionId: number;
};

class DataStore {
  private submissions: Submission[] = [];
  private questions: Question[] = [];
  private nextSubmissionId = 1;
  private nextQuestionId = 1;
  private dataFilePath: string;

  constructor() {
    this.dataFilePath = path.join(process.cwd(), "data", "store.json");
    this.ensureDataDirectory();
    this.load();
  }

  private ensureDataDirectory(): void {
    const dir = path.dirname(this.dataFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.dataFilePath)) {
        this.save();
        return;
      }

      const raw = fs.readFileSync(this.dataFilePath, "utf-8");

      if (!raw.trim()) {
        this.save();
        return;
      }

      const parsed = JSON.parse(raw) as Partial<PersistedData>;

      this.submissions = Array.isArray(parsed.submissions) ? parsed.submissions : [];
      this.questions = Array.isArray(parsed.questions) ? parsed.questions : [];
      this.nextSubmissionId =
        typeof parsed.nextSubmissionId === "number" ? parsed.nextSubmissionId : 1;
      this.nextQuestionId =
        typeof parsed.nextQuestionId === "number" ? parsed.nextQuestionId : 1;

      console.log("Store loaded from:", this.dataFilePath);
    } catch (error) {
      console.error("Failed to load data store:", error);
      this.submissions = [];
      this.questions = [];
      this.nextSubmissionId = 1;
      this.nextQuestionId = 1;
      this.save();
    }
  }

  private save(): void {
    const data: PersistedData = {
      submissions: this.submissions,
      questions: this.questions,
      nextSubmissionId: this.nextSubmissionId,
      nextQuestionId: this.nextQuestionId,
    };

    fs.writeFileSync(this.dataFilePath, JSON.stringify(data, null, 2), "utf-8");
  }

  addSubmission(text: string): Submission {
    const submission: Submission = {
      id: this.nextSubmissionId++,
      text,
      clustered: false,
    };

    this.submissions.push(submission);
    this.save();
    return submission;
  }

  getSubmissions(): Submission[] {
    return this.submissions;
  }

  getSubmissionById(id: number): Submission | undefined {
    return this.submissions.find((s) => s.id === id);
  }

  markSubmissionClustered(id: number, clusterId: string): void {
    const submission = this.getSubmissionById(id);

    if (submission) {
      submission.clustered = true;
      submission.clusterId = clusterId;
      this.save();
    }
  }

  addQuestion(input: Omit<Question, "id" | "votesYes" | "votesNo">): Question {
    const question: Question = {
      id: this.nextQuestionId++,
      title: input.title,
      description: input.description,
      argumentsFor: input.argumentsFor,
      argumentsAgainst: input.argumentsAgainst,
      votesYes: 0,
      votesNo: 0,
      clusterId: input.clusterId,
      sourceSubmissionIds: input.sourceSubmissionIds,
    };

    this.questions.push(question);
    this.save();
    return question;
  }

  getQuestions(): Question[] {
    return this.questions;
  }

  getQuestionById(id: number): Question | undefined {
    return this.questions.find((q) => q.id === id);
  }

  getQuestionByClusterId(clusterId: string): Question | undefined {
    return this.questions.find((q) => q.clusterId === clusterId);
  }

  updateQuestion(
    questionId: number,
    updates: Partial<Omit<Question, "id">>
  ): Question | undefined {
    const question = this.getQuestionById(questionId);

    if (!question) {
      return undefined;
    }

    Object.assign(question, updates);
    this.save();
    return question;
  }

  deleteQuestion(questionId: number): boolean {
    const before = this.questions.length;
    this.questions = this.questions.filter((q) => q.id !== questionId);
    const changed = this.questions.length !== before;

    if (changed) {
      this.save();
    }

    return changed;
  }

  addSubmissionIdsToQuestion(
    questionId: number,
    submissionIds: number[]
  ): Question | undefined {
    const question = this.getQuestionById(questionId);

    if (!question) {
      return undefined;
    }

    const merged = new Set<number>([
      ...question.sourceSubmissionIds,
      ...submissionIds,
    ]);

    question.sourceSubmissionIds = [...merged];
    this.save();
    return question;
  }

  addSubmissionIdsToQuestionByClusterId(
    clusterId: string,
    submissionIds: number[]
  ): Question | undefined {
    const question = this.getQuestionByClusterId(clusterId);

    if (!question) {
      return undefined;
    }

    const merged = new Set<number>([
      ...question.sourceSubmissionIds,
      ...submissionIds,
    ]);

    question.sourceSubmissionIds = [...merged];
    this.save();
    return question;
  }

  clearQuestions(): void {
    this.questions = [];
    this.nextQuestionId = 1;
    this.save();
  }

  voteOnQuestion(questionId: number, vote: "yes" | "no"): Question | undefined {
    const question = this.questions.find((q) => q.id === questionId);

    if (!question) {
      return undefined;
    }

    if (vote === "yes") {
      question.votesYes += 1;
    } else {
      question.votesNo += 1;
    }

    this.save();
    return question;
  }
}

export const dataStore = new DataStore();