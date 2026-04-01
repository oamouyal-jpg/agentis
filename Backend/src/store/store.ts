import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import type { CreateSpaceInput, Space } from "./spaceTypes";
import { PostgresDataStore } from "./postgresStore";

export type { CreateSpaceInput, Space } from "./spaceTypes";
export type { SpaceVisibility } from "./spaceTypes";

export type Submission = {
  id: number;
  spaceId: number;
  text: string;
  clustered?: boolean;
  clusterId?: string;
  createdAt?: number;
};

export type Question = {
  id: number;
  spaceId: number;
  title: string;
  description: string;
  argumentsFor: string[];
  argumentsAgainst: string[];
  votesYes: number;
  votesNo: number;
  clusterId: string;
  sourceSubmissionIds: number[];
  createdAt?: number;
};

export type AgentisStore = {
  ensureDefaultSpace(): Promise<void>;
  listSpaces(): Promise<Space[]>;
  createSpace(input: CreateSpaceInput): Promise<Space>;
  getSpaceBySlug(slug: string): Promise<Space | undefined>;
  getSpaceById(id: number): Promise<Space | undefined>;

  addSubmission(spaceId: number, text: string): Promise<Submission>;
  getSubmissions(spaceId: number): Promise<Submission[]>;
  getSubmissionById(spaceId: number, id: number): Promise<Submission | undefined>;
  markSubmissionClustered(
    spaceId: number,
    id: number,
    clusterId: string
  ): Promise<void>;

  addQuestion(
    spaceId: number,
    input: Omit<Question, "id" | "votesYes" | "votesNo" | "spaceId">
  ): Promise<Question>;
  getQuestions(spaceId: number): Promise<Question[]>;
  getQuestionById(spaceId: number, id: number): Promise<Question | undefined>;
  getQuestionByClusterId(
    spaceId: number,
    clusterId: string
  ): Promise<Question | undefined>;
  updateQuestion(
    spaceId: number,
    questionId: number,
    updates: Partial<Omit<Question, "id" | "spaceId">>
  ): Promise<Question | undefined>;
  deleteQuestion(spaceId: number, questionId: number): Promise<boolean>;
  addSubmissionIdsToQuestion(
    spaceId: number,
    questionId: number,
    submissionIds: number[]
  ): Promise<Question | undefined>;
  addSubmissionIdsToQuestionByClusterId(
    spaceId: number,
    clusterId: string,
    submissionIds: number[]
  ): Promise<Question | undefined>;
  clearQuestions(spaceId: number): Promise<void>;
  voteOnQuestion(
    spaceId: number,
    questionId: number,
    vote: "yes" | "no"
  ): Promise<Question | undefined>;
};

type PersistedData = {
  spaces: Space[];
  submissions: Submission[];
  questions: Question[];
  nextSubmissionId: number;
  nextQuestionId: number;
  nextSpaceId: number;
};

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase().replace(/\s+/g, "-");
}

class FileDataStore implements AgentisStore {
  private spaces: Space[] = [];
  private submissions: Submission[] = [];
  private questions: Question[] = [];
  private nextSubmissionId = 1;
  private nextQuestionId = 1;
  private nextSpaceId = 2;
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
        this.ensureDefaultSpaceSync();
        this.save();
        return;
      }

      const raw = fs.readFileSync(this.dataFilePath, "utf-8");

      if (!raw.trim()) {
        this.ensureDefaultSpaceSync();
        this.save();
        return;
      }

      const parsed = JSON.parse(raw) as Partial<PersistedData>;

      this.spaces = Array.isArray(parsed.spaces) ? parsed.spaces : [];
      this.submissions = Array.isArray(parsed.submissions) ? parsed.submissions : [];
      this.questions = Array.isArray(parsed.questions) ? parsed.questions : [];
      this.nextSubmissionId =
        typeof parsed.nextSubmissionId === "number" ? parsed.nextSubmissionId : 1;
      this.nextQuestionId =
        typeof parsed.nextQuestionId === "number" ? parsed.nextQuestionId : 1;
      this.nextSpaceId =
        typeof parsed.nextSpaceId === "number" ? parsed.nextSpaceId : 2;

      this.migrateLegacy();
      this.ensureDefaultSpaceSync();

      console.log("Store loaded from:", this.dataFilePath);
    } catch (error) {
      console.error("Failed to load data store:", error);
      this.spaces = [];
      this.submissions = [];
      this.questions = [];
      this.nextSubmissionId = 1;
      this.nextQuestionId = 1;
      this.nextSpaceId = 2;
      this.ensureDefaultSpaceSync();
      this.save();
    }
  }

  private migrateLegacy(): void {
    const openId = 1;
    if (this.spaces.length === 0) {
      this.spaces.push({
        id: openId,
        name: "Open",
        slug: "open",
        description: "Public crowd signal — anyone can participate.",
        visibility: "public",
        inviteSecret: null,
      });
      this.nextSpaceId = Math.max(this.nextSpaceId, 2);
    }
    for (const s of this.submissions) {
      if (typeof (s as Submission).spaceId !== "number") {
        (s as Submission).spaceId = openId;
      }
    }
    for (const q of this.questions) {
      if (typeof (q as Question).spaceId !== "number") {
        (q as Question).spaceId = openId;
      }
    }
  }

  private ensureDefaultSpaceSync(): void {
    if (!this.spaces.some((s) => s.slug === "open")) {
      this.spaces.unshift({
        id: 1,
        name: "Open",
        slug: "open",
        description: "Public crowd signal — anyone can participate.",
        visibility: "public",
        inviteSecret: null,
      });
    }
  }

  private save(): void {
    const data: PersistedData = {
      spaces: this.spaces,
      submissions: this.submissions,
      questions: this.questions,
      nextSubmissionId: this.nextSubmissionId,
      nextQuestionId: this.nextQuestionId,
      nextSpaceId: this.nextSpaceId,
    };

    fs.writeFileSync(this.dataFilePath, JSON.stringify(data, null, 2), "utf-8");
  }

  async ensureDefaultSpace(): Promise<void> {
    this.ensureDefaultSpaceSync();
    this.save();
  }

  async listSpaces(): Promise<Space[]> {
    return this.spaces.map((s) => ({ ...s }));
  }

  async createSpace(input: CreateSpaceInput): Promise<Space> {
    const slug = normalizeSlug(input.slug);
    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new Error("Invalid slug (use lowercase letters, numbers, hyphens)");
    }
    if (this.spaces.some((s) => s.slug === slug)) {
      throw new Error("Slug already exists");
    }

    const id = this.nextSpaceId++;
    const inviteSecret =
      input.visibility === "members_only"
        ? crypto.randomBytes(24).toString("base64url")
        : null;

    const space: Space = {
      id,
      name: input.name.trim(),
      slug,
      description: (input.description ?? "").trim(),
      visibility: input.visibility,
      inviteSecret,
    };

    this.spaces.push(space);
    this.save();
    return { ...space };
  }

  async getSpaceBySlug(slug: string): Promise<Space | undefined> {
    const s = this.spaces.find((x) => x.slug === normalizeSlug(slug));
    return s ? { ...s } : undefined;
  }

  async getSpaceById(id: number): Promise<Space | undefined> {
    const s = this.spaces.find((x) => x.id === id);
    return s ? { ...s } : undefined;
  }

  async addSubmission(spaceId: number, text: string): Promise<Submission> {
    const submission: Submission = {
      id: this.nextSubmissionId++,
      spaceId,
      text,
      clustered: false,
      createdAt: Date.now(),
    };

    this.submissions.push(submission);
    this.save();
    return submission;
  }

  async getSubmissions(spaceId: number): Promise<Submission[]> {
    return this.submissions.filter((s) => s.spaceId === spaceId);
  }

  async getSubmissionById(
    spaceId: number,
    id: number
  ): Promise<Submission | undefined> {
    const s = this.submissions.find((x) => x.id === id && x.spaceId === spaceId);
    return s ? { ...s } : undefined;
  }

  async markSubmissionClustered(
    spaceId: number,
    id: number,
    clusterId: string
  ): Promise<void> {
    const submission = await this.getSubmissionById(spaceId, id);

    if (submission) {
      const idx = this.submissions.findIndex((x) => x.id === id && x.spaceId === spaceId);
      if (idx >= 0) {
        this.submissions[idx].clustered = true;
        this.submissions[idx].clusterId = clusterId;
        this.save();
      }
    }
  }

  async addQuestion(
    spaceId: number,
    input: Omit<Question, "id" | "votesYes" | "votesNo" | "spaceId">
  ): Promise<Question> {
    const question: Question = {
      id: this.nextQuestionId++,
      spaceId,
      title: input.title,
      description: input.description,
      argumentsFor: input.argumentsFor,
      argumentsAgainst: input.argumentsAgainst,
      votesYes: 0,
      votesNo: 0,
      clusterId: input.clusterId,
      sourceSubmissionIds: input.sourceSubmissionIds,
      createdAt: input.createdAt ?? Date.now(),
    };

    this.questions.push(question);
    this.save();
    return question;
  }

  async getQuestions(spaceId: number): Promise<Question[]> {
    return this.questions.filter((q) => q.spaceId === spaceId);
  }

  async getQuestionById(spaceId: number, id: number): Promise<Question | undefined> {
    const q = this.questions.find((x) => x.id === id && x.spaceId === spaceId);
    return q ? { ...q, sourceSubmissionIds: [...q.sourceSubmissionIds] } : undefined;
  }

  async getQuestionByClusterId(
    spaceId: number,
    clusterId: string
  ): Promise<Question | undefined> {
    const q = this.questions.find(
      (x) => x.spaceId === spaceId && x.clusterId === clusterId
    );
    return q ? { ...q, sourceSubmissionIds: [...q.sourceSubmissionIds] } : undefined;
  }

  async updateQuestion(
    spaceId: number,
    questionId: number,
    updates: Partial<Omit<Question, "id" | "spaceId">>
  ): Promise<Question | undefined> {
    const question = await this.getQuestionById(spaceId, questionId);

    if (!question) {
      return undefined;
    }

    const idx = this.questions.findIndex(
      (x) => x.id === questionId && x.spaceId === spaceId
    );
    if (idx < 0) return undefined;

    Object.assign(this.questions[idx], updates);
    this.save();
    return this.getQuestionById(spaceId, questionId);
  }

  async deleteQuestion(spaceId: number, questionId: number): Promise<boolean> {
    const before = this.questions.length;
    this.questions = this.questions.filter(
      (q) => !(q.id === questionId && q.spaceId === spaceId)
    );
    const changed = this.questions.length !== before;

    if (changed) {
      this.save();
    }

    return changed;
  }

  async addSubmissionIdsToQuestion(
    spaceId: number,
    questionId: number,
    submissionIds: number[]
  ): Promise<Question | undefined> {
    const question = await this.getQuestionById(spaceId, questionId);

    if (!question) {
      return undefined;
    }

    const merged = new Set<number>([
      ...question.sourceSubmissionIds,
      ...submissionIds,
    ]);

    return this.updateQuestion(spaceId, questionId, {
      sourceSubmissionIds: [...merged],
    });
  }

  async addSubmissionIdsToQuestionByClusterId(
    spaceId: number,
    clusterId: string,
    submissionIds: number[]
  ): Promise<Question | undefined> {
    const question = await this.getQuestionByClusterId(spaceId, clusterId);

    if (!question) {
      return undefined;
    }

    return this.addSubmissionIdsToQuestion(spaceId, question.id, submissionIds);
  }

  async clearQuestions(spaceId: number): Promise<void> {
    this.questions = this.questions.filter((q) => q.spaceId !== spaceId);
    this.save();
  }

  async voteOnQuestion(
    spaceId: number,
    questionId: number,
    vote: "yes" | "no"
  ): Promise<Question | undefined> {
    const idx = this.questions.findIndex(
      (q) => q.id === questionId && q.spaceId === spaceId
    );

    if (idx < 0) {
      return undefined;
    }

    if (vote === "yes") {
      this.questions[idx].votesYes += 1;
    } else {
      this.questions[idx].votesNo += 1;
    }

    this.save();
    return this.getQuestionById(spaceId, questionId);
  }
}

export const dataStore: AgentisStore = process.env.DATABASE_URL
  ? new PostgresDataStore(process.env.DATABASE_URL)
  : new FileDataStore();
