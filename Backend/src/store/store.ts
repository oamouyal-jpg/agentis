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
  /** Optional hero image for press-style display (HTTPS URL). */
  imageUrl?: string;
  /** Host-editable: plain language for what a Yes vote means. */
  yesMeans?: string;
  /** Host-editable: plain language for what a No vote means. */
  noMeans?: string;
  createdAt?: number;
};

export type VoteDemographics = {
  gender?: string;
  ageRange?: string;
  country?: string;
  town?: string;
};

export type VoteEvent = {
  id: number;
  spaceId: number;
  questionId: number;
  vote: "yes" | "no";
  demographics?: VoteDemographics;
  createdAt?: number;
};

/** Device switched Yes↔No; still one vote per device. Use for “changed mind after X time” analysis. */
export type VoteFlipEvent = {
  id: number;
  spaceId: number;
  questionId: number;
  deviceId: string;
  fromVote: "yes" | "no";
  toVote: "yes" | "no";
  /** Milliseconds between first vote and this flip. */
  msSinceFirstVote: number;
  createdAt?: number;
};

export type SubmitVoteResult =
  | {
      ok: true;
      question: Question;
      status: "created" | "changed" | "unchanged";
      previousVote?: "yes" | "no";
      /** False after the one allowed vote change has been used. */
      canChangeVote: boolean;
    }
  | { ok: false; reason: "not_found" | "vote_change_limit" };

export type Petition = {
  id: number;
  spaceId: number;
  title: string;
  description: string;
  goalSignatures?: number;
  createdAt?: number;
};

export type PetitionSignature = {
  id: number;
  spaceId: number;
  petitionId: number;
  name?: string;
  email?: string;
  country?: string;
  town?: string;
  createdAt?: number;
};

export type QuestionUpdate = {
  id: number;
  spaceId: number;
  questionId: number;
  title: string;
  body: string;
  createdAt?: number;
};

/** Public thread under a question (below voting). */
export type QuestionComment = {
  id: number;
  spaceId: number;
  questionId: number;
  body: string;
  authorName?: string;
  createdAt?: number;
  /** Set when listing comments for API responses. */
  likeCount?: number;
  /** Whether the requesting device liked this comment. */
  liked?: boolean;
};

export type AgentisStore = {
  ensureDefaultSpace(): Promise<void>;
  listSpaces(): Promise<Space[]>;
  createSpace(input: CreateSpaceInput): Promise<Space>;
  getSpaceBySlug(slug: string): Promise<Space | undefined>;
  getSpaceById(id: number): Promise<Space | undefined>;
  updateSpace(
    spaceId: number,
    updates: Partial<Omit<Space, "id" | "slug" | "inviteSecret" | "hostSecret">> & {
      branding?: Space["branding"];
    }
  ): Promise<Space | undefined>;

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

  /** One active vote per device; one Yes↔No switch allowed (tallies adjust). */
  submitQuestionVote(
    spaceId: number,
    questionId: number,
    deviceId: string,
    vote: "yes" | "no",
    demographics?: VoteDemographics
  ): Promise<SubmitVoteResult>;

  listVoteFlipEvents(spaceId: number): Promise<VoteFlipEvent[]>;

  listQuestionUpdates(spaceId: number, questionId: number): Promise<QuestionUpdate[]>;
  addQuestionUpdate(
    spaceId: number,
    questionId: number,
    input: Omit<QuestionUpdate, "id" | "spaceId" | "questionId" | "createdAt">
  ): Promise<QuestionUpdate>;

  listQuestionComments(
    spaceId: number,
    questionId: number
  ): Promise<QuestionComment[]>;
  /** All discussion comments in a space (e.g. CSV export). */
  listQuestionCommentsForSpace(spaceId: number): Promise<QuestionComment[]>;
  addQuestionComment(
    spaceId: number,
    questionId: number,
    input: Omit<QuestionComment, "id" | "spaceId" | "questionId" | "createdAt">
  ): Promise<QuestionComment>;

  /** Per-comment like counts and whether `deviceId` has liked (if provided). */
  getCommentLikeInfo(
    spaceId: number,
    commentIds: number[],
    deviceId: string | null
  ): Promise<Record<number, { count: number; liked: boolean }>>;

  /** Toggle like for this device; comment must belong to this question in `spaceId`. */
  toggleCommentLike(
    spaceId: number,
    questionId: number,
    commentId: number,
    deviceId: string
  ): Promise<
    | { ok: true; count: number; liked: boolean }
    | { ok: false; reason: "not_found" }
  >;

  addVoteEvent(
    spaceId: number,
    input: Omit<VoteEvent, "id" | "spaceId">
  ): Promise<VoteEvent>;
  getVoteEvents(spaceId: number): Promise<VoteEvent[]>;

  listPetitions(spaceId: number): Promise<Petition[]>;
  getPetitionById(spaceId: number, petitionId: number): Promise<Petition | undefined>;
  createPetition(
    spaceId: number,
    input: Omit<Petition, "id" | "spaceId" | "createdAt">
  ): Promise<Petition>;
  signPetition(
    spaceId: number,
    petitionId: number,
    input: Omit<PetitionSignature, "id" | "spaceId" | "petitionId" | "createdAt">
  ): Promise<PetitionSignature>;
  getPetitionSignatures(
    spaceId: number,
    petitionId: number
  ): Promise<PetitionSignature[]>;
};

type DeviceVoteKey = {
  spaceId: number;
  questionId: number;
  deviceId: string;
  vote: "yes" | "no";
  /** When this device first voted on this question (for flip timing). */
  createdAt: number;
  /** True after this device has used its single allowed vote change. */
  voteChangeUsed?: boolean;
};

type CommentLikeEntry = {
  commentId: number;
  deviceId: string;
};

type PersistedData = {
  spaces: Space[];
  submissions: Submission[];
  questions: Question[];
  voteEvents?: VoteEvent[];
  deviceVotes?: DeviceVoteKey[];
  petitions?: Petition[];
  petitionSignatures?: PetitionSignature[];
  questionUpdates?: QuestionUpdate[];
  questionComments?: QuestionComment[];
  commentLikes?: CommentLikeEntry[];
  voteFlipEvents?: VoteFlipEvent[];
  nextSubmissionId: number;
  nextQuestionId: number;
  nextVoteEventId?: number;
  nextPetitionId?: number;
  nextPetitionSignatureId?: number;
  nextQuestionUpdateId?: number;
  nextQuestionCommentId?: number;
  nextVoteFlipId?: number;
  nextSpaceId: number;
};

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase().replace(/\s+/g, "-");
}

class FileDataStore implements AgentisStore {
  private spaces: Space[] = [];
  private submissions: Submission[] = [];
  private questions: Question[] = [];
  private voteEvents: VoteEvent[] = [];
  private deviceVotes: DeviceVoteKey[] = [];
  private petitions: Petition[] = [];
  private petitionSignatures: PetitionSignature[] = [];
  private questionUpdates: QuestionUpdate[] = [];
  private questionComments: QuestionComment[] = [];
  private commentLikes: CommentLikeEntry[] = [];
  private voteFlipEvents: VoteFlipEvent[] = [];
  private nextSubmissionId = 1;
  private nextQuestionId = 1;
  private nextVoteEventId = 1;
  private nextPetitionId = 1;
  private nextPetitionSignatureId = 1;
  private nextQuestionUpdateId = 1;
  private nextQuestionCommentId = 1;
  private nextVoteFlipId = 1;
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
      this.voteEvents = Array.isArray(parsed.voteEvents) ? parsed.voteEvents : [];
      this.deviceVotes = Array.isArray(parsed.deviceVotes) ? parsed.deviceVotes : [];
      this.nextVoteEventId =
        typeof parsed.nextVoteEventId === "number"
          ? parsed.nextVoteEventId
          : this.voteEvents.reduce((m, v) => Math.max(m, v.id), 0) + 1;
      this.petitions = Array.isArray(parsed.petitions) ? parsed.petitions : [];
      this.petitionSignatures = Array.isArray(parsed.petitionSignatures)
        ? parsed.petitionSignatures
        : [];
      this.nextPetitionId =
        typeof parsed.nextPetitionId === "number"
          ? parsed.nextPetitionId
          : this.petitions.reduce((m, p) => Math.max(m, p.id), 0) + 1;
      this.nextPetitionSignatureId =
        typeof parsed.nextPetitionSignatureId === "number"
          ? parsed.nextPetitionSignatureId
          : this.petitionSignatures.reduce((m, s) => Math.max(m, s.id), 0) + 1;

      this.questionUpdates = Array.isArray(parsed.questionUpdates)
        ? parsed.questionUpdates
        : [];
      this.nextQuestionUpdateId =
        typeof parsed.nextQuestionUpdateId === "number"
          ? parsed.nextQuestionUpdateId
          : this.questionUpdates.reduce((m, u) => Math.max(m, u.id), 0) + 1;

      this.questionComments = Array.isArray(parsed.questionComments)
        ? parsed.questionComments
        : [];
      this.nextQuestionCommentId =
        typeof parsed.nextQuestionCommentId === "number"
          ? parsed.nextQuestionCommentId
          : this.questionComments.reduce((m, c) => Math.max(m, c.id), 0) + 1;

      this.commentLikes = Array.isArray(parsed.commentLikes) ? parsed.commentLikes : [];

      this.voteFlipEvents = Array.isArray(parsed.voteFlipEvents)
        ? parsed.voteFlipEvents
        : [];
      this.nextVoteFlipId =
        typeof parsed.nextVoteFlipId === "number"
          ? parsed.nextVoteFlipId
          : this.voteFlipEvents.reduce((m, v) => Math.max(m, v.id), 0) + 1;

      this.migrateLegacy();
      this.ensureDefaultSpaceSync();

      console.log("Store loaded from:", this.dataFilePath);
    } catch (error) {
      console.error("Failed to load data store:", error);
      this.spaces = [];
      this.submissions = [];
      this.questions = [];
      this.voteEvents = [];
      this.deviceVotes = [];
      this.petitions = [];
      this.petitionSignatures = [];
      this.questionUpdates = [];
      this.questionComments = [];
      this.commentLikes = [];
      this.voteFlipEvents = [];
      this.nextVoteFlipId = 1;
      this.nextSubmissionId = 1;
      this.nextQuestionId = 1;
      this.nextVoteEventId = 1;
      this.nextPetitionId = 1;
      this.nextPetitionSignatureId = 1;
      this.nextQuestionUpdateId = 1;
      this.nextQuestionCommentId = 1;
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
        hostSecret: crypto.randomBytes(24).toString("base64url"),
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

    for (const sp of this.spaces as any[]) {
      if (typeof sp.hostSecret !== "string" || !sp.hostSecret) {
        sp.hostSecret = crypto.randomBytes(24).toString("base64url");
      }
    }

    for (const sp of this.spaces as any[]) {
      if (sp.branding === undefined || sp.branding === null) {
        sp.branding = undefined;
      }
      if (sp.branding && typeof sp.branding !== "object") {
        sp.branding = undefined;
      }
    }

    for (const d of this.deviceVotes) {
      if (typeof d.createdAt !== "number") {
        d.createdAt = Date.now();
      }
      if (d.voteChangeUsed === undefined) {
        const flipped = this.voteFlipEvents.some(
          (e) =>
            e.spaceId === d.spaceId &&
            e.questionId === d.questionId &&
            e.deviceId === d.deviceId
        );
        d.voteChangeUsed = flipped;
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
        hostSecret: crypto.randomBytes(24).toString("base64url"),
        branding: undefined,
      });
    }
  }

  private save(): void {
    const data: PersistedData = {
      spaces: this.spaces,
      submissions: this.submissions,
      questions: this.questions,
      voteEvents: this.voteEvents,
      deviceVotes: this.deviceVotes,
      petitions: this.petitions,
      petitionSignatures: this.petitionSignatures,
      questionUpdates: this.questionUpdates,
      questionComments: this.questionComments,
      commentLikes: this.commentLikes,
      voteFlipEvents: this.voteFlipEvents,
      nextSubmissionId: this.nextSubmissionId,
      nextQuestionId: this.nextQuestionId,
      nextVoteEventId: this.nextVoteEventId,
      nextPetitionId: this.nextPetitionId,
      nextPetitionSignatureId: this.nextPetitionSignatureId,
      nextQuestionUpdateId: this.nextQuestionUpdateId,
      nextQuestionCommentId: this.nextQuestionCommentId,
      nextVoteFlipId: this.nextVoteFlipId,
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
    const hostSecret = crypto.randomBytes(24).toString("base64url");

    const space: Space = {
      id,
      name: input.name.trim(),
      slug,
      description: (input.description ?? "").trim(),
      visibility: input.visibility,
      inviteSecret,
      hostSecret,
      branding: undefined,
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

  async updateSpace(
    spaceId: number,
    updates: Partial<Omit<Space, "id" | "slug" | "inviteSecret" | "hostSecret">> & {
      branding?: Space["branding"];
    }
  ): Promise<Space | undefined> {
    const idx = this.spaces.findIndex((s) => s.id === spaceId);
    if (idx < 0) return undefined;

    const current = this.spaces[idx];
    const merged: Space = {
      ...current,
      ...updates,
      id: current.id,
      slug: current.slug,
      inviteSecret: current.inviteSecret,
      hostSecret: current.hostSecret,
    };

    this.spaces[idx] = merged;
    this.save();
    return { ...merged };
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
      imageUrl: input.imageUrl,
      yesMeans: input.yesMeans,
      noMeans: input.noMeans,
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

  async submitQuestionVote(
    spaceId: number,
    questionId: number,
    deviceId: string,
    vote: "yes" | "no",
    demographics?: VoteDemographics
  ): Promise<SubmitVoteResult> {
    const qidx = this.questions.findIndex(
      (q) => q.id === questionId && q.spaceId === spaceId
    );
    if (qidx < 0) {
      return { ok: false, reason: "not_found" };
    }

    const dvIdx = this.deviceVotes.findIndex(
      (d) =>
        d.spaceId === spaceId &&
        d.questionId === questionId &&
        d.deviceId === deviceId
    );

    if (dvIdx < 0) {
      const now = Date.now();
      this.deviceVotes.push({
        spaceId,
        questionId,
        deviceId,
        vote,
        createdAt: now,
        voteChangeUsed: false,
      });
      if (vote === "yes") {
        this.questions[qidx].votesYes += 1;
      } else {
        this.questions[qidx].votesNo += 1;
      }
      this.voteEvents.push({
        id: this.nextVoteEventId++,
        spaceId,
        questionId,
        vote,
        demographics,
        createdAt: now,
      });
      this.save();
      const q = await this.getQuestionById(spaceId, questionId);
      return q
        ? { ok: true, question: q, status: "created", canChangeVote: true }
        : { ok: false, reason: "not_found" };
    }

    const prev = this.deviceVotes[dvIdx].vote;
    if (prev === vote) {
      const q = await this.getQuestionById(spaceId, questionId);
      const used = !!this.deviceVotes[dvIdx].voteChangeUsed;
      return q
        ? {
            ok: true,
            question: q,
            status: "unchanged",
            canChangeVote: !used,
          }
        : { ok: false, reason: "not_found" };
    }

    if (this.deviceVotes[dvIdx].voteChangeUsed) {
      return { ok: false, reason: "vote_change_limit" };
    }

    const firstAt = this.deviceVotes[dvIdx].createdAt;
    this.deviceVotes[dvIdx].vote = vote;
    this.deviceVotes[dvIdx].voteChangeUsed = true;

    if (prev === "yes") {
      this.questions[qidx].votesYes -= 1;
      this.questions[qidx].votesNo += 1;
    } else {
      this.questions[qidx].votesNo -= 1;
      this.questions[qidx].votesYes += 1;
    }

    const now = Date.now();
    this.voteEvents.push({
      id: this.nextVoteEventId++,
      spaceId,
      questionId,
      vote,
      demographics,
      createdAt: now,
    });

    this.voteFlipEvents.push({
      id: this.nextVoteFlipId++,
      spaceId,
      questionId,
      deviceId,
      fromVote: prev,
      toVote: vote,
      msSinceFirstVote: Math.max(0, now - firstAt),
      createdAt: now,
    });
    this.save();

    const q = await this.getQuestionById(spaceId, questionId);
    return q
      ? {
          ok: true,
          question: q,
          status: "changed",
          previousVote: prev,
          canChangeVote: false,
        }
      : { ok: false, reason: "not_found" };
  }

  async listVoteFlipEvents(spaceId: number): Promise<VoteFlipEvent[]> {
    return this.voteFlipEvents
      .filter((e) => e.spaceId === spaceId)
      .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
      .map((e) => ({ ...e }));
  }

  async addVoteEvent(
    spaceId: number,
    input: Omit<VoteEvent, "id" | "spaceId">
  ): Promise<VoteEvent> {
    const ev: VoteEvent = {
      id: this.nextVoteEventId++,
      spaceId,
      questionId: input.questionId,
      vote: input.vote,
      demographics: input.demographics,
      createdAt: Date.now(),
    };
    this.voteEvents.push(ev);
    this.save();
    return ev;
  }

  async getVoteEvents(spaceId: number): Promise<VoteEvent[]> {
    return this.voteEvents.filter((v) => v.spaceId === spaceId);
  }

  async listPetitions(spaceId: number): Promise<Petition[]> {
    return this.petitions.filter((p) => p.spaceId === spaceId);
  }

  async getPetitionById(
    spaceId: number,
    petitionId: number
  ): Promise<Petition | undefined> {
    const p = this.petitions.find((x) => x.spaceId === spaceId && x.id === petitionId);
    return p ? { ...p } : undefined;
  }

  async createPetition(
    spaceId: number,
    input: Omit<Petition, "id" | "spaceId" | "createdAt">
  ): Promise<Petition> {
    const p: Petition = {
      id: this.nextPetitionId++,
      spaceId,
      title: input.title.trim(),
      description: input.description.trim(),
      goalSignatures:
        typeof input.goalSignatures === "number" ? input.goalSignatures : undefined,
      createdAt: Date.now(),
    };
    this.petitions.push(p);
    this.save();
    return { ...p };
  }

  async signPetition(
    spaceId: number,
    petitionId: number,
    input: Omit<PetitionSignature, "id" | "spaceId" | "petitionId" | "createdAt">
  ): Promise<PetitionSignature> {
    const sig: PetitionSignature = {
      id: this.nextPetitionSignatureId++,
      spaceId,
      petitionId,
      name: input.name?.trim() || undefined,
      email: input.email?.trim() || undefined,
      country: input.country?.trim() || undefined,
      town: input.town?.trim() || undefined,
      createdAt: Date.now(),
    };
    this.petitionSignatures.push(sig);
    this.save();
    return { ...sig };
  }

  async getPetitionSignatures(
    spaceId: number,
    petitionId: number
  ): Promise<PetitionSignature[]> {
    return this.petitionSignatures.filter(
      (s) => s.spaceId === spaceId && s.petitionId === petitionId
    );
  }

  async listQuestionUpdates(
    spaceId: number,
    questionId: number
  ): Promise<QuestionUpdate[]> {
    return this.questionUpdates
      .filter((u) => u.spaceId === spaceId && u.questionId === questionId)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .map((u) => ({ ...u }));
  }

  async addQuestionUpdate(
    spaceId: number,
    questionId: number,
    input: Omit<QuestionUpdate, "id" | "spaceId" | "questionId" | "createdAt">
  ): Promise<QuestionUpdate> {
    const u: QuestionUpdate = {
      id: this.nextQuestionUpdateId++,
      spaceId,
      questionId,
      title: input.title.trim(),
      body: input.body.trim(),
      createdAt: Date.now(),
    };
    this.questionUpdates.push(u);
    this.save();
    return { ...u };
  }

  async listQuestionComments(
    spaceId: number,
    questionId: number
  ): Promise<QuestionComment[]> {
    return this.questionComments
      .filter((c) => c.spaceId === spaceId && c.questionId === questionId)
      .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
      .map((c) => ({ ...c }));
  }

  async listQuestionCommentsForSpace(spaceId: number): Promise<QuestionComment[]> {
    return this.questionComments
      .filter((c) => c.spaceId === spaceId)
      .sort((a, b) => {
        const q = a.questionId - b.questionId;
        if (q !== 0) return q;
        return (a.createdAt ?? 0) - (b.createdAt ?? 0);
      })
      .map((c) => ({ ...c }));
  }

  async addQuestionComment(
    spaceId: number,
    questionId: number,
    input: Omit<QuestionComment, "id" | "spaceId" | "questionId" | "createdAt">
  ): Promise<QuestionComment> {
    const c: QuestionComment = {
      id: this.nextQuestionCommentId++,
      spaceId,
      questionId,
      body: input.body.trim(),
      authorName: input.authorName?.trim() || undefined,
      createdAt: Date.now(),
    };
    this.questionComments.push(c);
    this.save();
    return { ...c };
  }

  async getCommentLikeInfo(
    spaceId: number,
    commentIds: number[],
    deviceId: string | null
  ): Promise<Record<number, { count: number; liked: boolean }>> {
    const out: Record<number, { count: number; liked: boolean }> = {};
    const validIds = new Set(
      this.questionComments
        .filter((c) => c.spaceId === spaceId && commentIds.includes(c.id))
        .map((c) => c.id)
    );
    for (const id of commentIds) {
      if (!validIds.has(id)) continue;
      const forComment = this.commentLikes.filter((l) => l.commentId === id);
      out[id] = {
        count: forComment.length,
        liked: Boolean(
          deviceId && forComment.some((l) => l.deviceId === deviceId)
        ),
      };
    }
    return out;
  }

  async toggleCommentLike(
    spaceId: number,
    questionId: number,
    commentId: number,
    deviceId: string
  ): Promise<
    | { ok: true; count: number; liked: boolean }
    | { ok: false; reason: "not_found" }
  > {
    const c = this.questionComments.find(
      (x) =>
        x.id === commentId &&
        x.spaceId === spaceId &&
        x.questionId === questionId
    );
    if (!c) {
      return { ok: false, reason: "not_found" };
    }
    const idx = this.commentLikes.findIndex(
      (l) => l.commentId === commentId && l.deviceId === deviceId
    );
    let liked: boolean;
    if (idx >= 0) {
      this.commentLikes.splice(idx, 1);
      liked = false;
    } else {
      this.commentLikes.push({ commentId, deviceId });
      liked = true;
    }
    const count = this.commentLikes.filter((l) => l.commentId === commentId).length;
    this.save();
    return { ok: true, count, liked };
  }
}

export const dataStore: AgentisStore = process.env.DATABASE_URL
  ? new PostgresDataStore(process.env.DATABASE_URL)
  : new FileDataStore();
