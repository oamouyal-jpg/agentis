import dotenv from "dotenv";
import * as fs from "fs";
import path from "path";

const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

import express, { Request, Response } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import adminRoutes from "./modules/ai/admin.routes";
import { scheduleClusteringAfterSubmission } from "./modules/ai/runClusteringForSpace";
import { getTrendingApiPayload } from "./services/trending.service";
import { dataStore, type Question } from "./store/store";
import type { Space } from "./store/spaceTypes";
import { loadSpaceBySlug, requireHostAccess, requireSpaceAccess } from "./middleware/spaceContext";
import { buildInsightsForSpace } from "./services/buildInsights";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.set("trust proxy", 1);

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const isLocalBrowserOrigin = (origin: string) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

/** In non-production, always allow localhost so dev works even if CORS_ORIGINS is copied from prod. */
function corsAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (allowedOrigins.length === 0) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (process.env.NODE_ENV !== "production" && isLocalBrowserOrigin(origin)) {
    return true;
  }
  return false;
}

app.use(
  cors({
    origin(origin, callback) {
      if (corsAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin || "(none)"}`));
    },
  })
);
app.use(express.json({ limit: "1mb" }));

const writeLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

/** Stable client id from localStorage; required for voting (one vote per device per question). */
function parseDeviceId(req: Request): string | null {
  const h = req.headers["x-space-device"];
  const fromHeader = typeof h === "string" ? h.trim() : "";
  const body = req.body as { deviceId?: string } | undefined;
  const fromBody =
    body && typeof body.deviceId === "string" ? body.deviceId.trim() : "";
  const raw = fromHeader || fromBody;
  if (!raw || raw.length > 128) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(raw)) return null;
  return raw;
}

function escapeCsvCell(value: string | number | undefined | null): string {
  const s = value === undefined || value === null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvLine(cells: (string | number | undefined | null)[]): string {
  return cells.map((c) => escapeCsvCell(c)).join(",") + "\r\n";
}

function publicSpace(space: Space) {
  return {
    id: space.id,
    name: space.name,
    slug: space.slug,
    description: space.description,
    visibility: space.visibility,
    membersOnly: space.visibility === "members_only",
    branding: space.branding ?? undefined,
  };
}

async function openSpaceId(): Promise<number> {
  await dataStore.ensureDefaultSpace();
  const s = await dataStore.getSpaceBySlug("open");
  if (!s) throw new Error("Default open space missing");
  return s.id;
}

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    status: "healthy",
  });
});

app.get("/", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    message: "Agentis backend running",
  });
});

app.get("/spaces", async (_req: Request, res: Response) => {
  try {
    await dataStore.ensureDefaultSpace();
    const spaces = await dataStore.listSpaces();
    res.json(spaces.map(publicSpace));
  } catch (e) {
    res.status(500).json({
      error: "Failed to list spaces",
      details: e instanceof Error ? e.message : String(e),
    });
  }
});

app.post("/spaces", writeLimiter, async (req: Request, res: Response) => {
  try {
    const { name, slug, description, visibility } = req.body as {
      name?: string;
      slug?: string;
      description?: string;
      visibility?: "public" | "members_only";
    };

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ ok: false, error: "name is required" });
    }
    if (!slug || typeof slug !== "string" || !slug.trim()) {
      return res.status(400).json({ ok: false, error: "slug is required" });
    }
    if (visibility !== "public" && visibility !== "members_only") {
      return res.status(400).json({
        ok: false,
        error: 'visibility must be "public" or "members_only"',
      });
    }

    await dataStore.ensureDefaultSpace();
    const space = await dataStore.createSpace({
      name: name.trim(),
      slug: slug.trim(),
      description: description ?? "",
      visibility,
    });

    return res.json({
      ok: true,
      space: publicSpace(space),
      inviteSecret:
        space.visibility === "members_only" ? space.inviteSecret : undefined,
      hostSecret: space.hostSecret,
    });
  } catch (e) {
    return res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
});

app.get("/spaces/:slug", loadSpaceBySlug, async (_req: Request, res: Response) => {
  const space = res.locals.space as Space;
  res.json(publicSpace(space));
});

/**
 * Same character rules as parseDeviceId so GET /questions and POST /vote
 * always refer to the same device id (avoids mismatched myVote).
 */
function readDeviceIdForAttach(req: Request): string {
  const raw = req.get("X-Space-Device");
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed || trimmed.length > 128) return "";
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return "";
  return trimmed;
}

function questionWithMyVotePayload(
  q: Question,
  currentVote: "yes" | "no",
  canChangeVote: boolean
): Question {
  return {
    ...q,
    myVote: currentVote,
    myVoteChangeExhausted: !canChangeVote,
  };
}

/** Merge per-device vote state into question list (fixes client-only localStorage drift). */
async function attachDeviceVotesToQuestions(
  questions: Question[],
  spaceId: number,
  deviceId: string
): Promise<Question[]> {
  if (!deviceId) return questions;
  const states = await dataStore.getDeviceVoteStatesForSpace(spaceId, deviceId);
  return questions.map((q) => {
    const s = states.get(q.id);
    if (!s) {
      const { myVote: _a, myVoteChangeExhausted: _b, ...rest } = q as Question & {
        myVote?: unknown;
        myVoteChangeExhausted?: unknown;
      };
      return rest as Question;
    }
    return {
      ...q,
      myVote: s.vote,
      myVoteChangeExhausted: s.changeUsed,
    };
  });
}

const spaceRouter = express.Router({ mergeParams: true });
spaceRouter.use(loadSpaceBySlug);
spaceRouter.use(requireSpaceAccess);

spaceRouter.get("/questions", async (req: Request, res: Response) => {
  const spaceId = res.locals.spaceId as number;
  const deviceId = readDeviceIdForAttach(req);
  let questions = await dataStore.getQuestions(spaceId);
  questions = await attachDeviceVotesToQuestions(questions, spaceId, deviceId);
  res.json(questions);
});

/** What’s hot + emerging topics from submissions/comments (see trending.service.ts). */
spaceRouter.get("/trending", async (_req: Request, res: Response) => {
  try {
    const spaceId = res.locals.spaceId as number;
    res.json(await getTrendingApiPayload(spaceId));
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
});

spaceRouter.get(
  "/questions/:questionId/updates",
  async (req: Request, res: Response) => {
    try {
      const spaceId = res.locals.spaceId as number;
      const questionId = Number(req.params.questionId);
      if (!Number.isFinite(questionId)) {
        return res.status(400).json({ ok: false, error: "Invalid question id" });
      }
      const updates = await dataStore.listQuestionUpdates(spaceId, questionId);
      return res.json(updates);
    } catch (e) {
      return res
        .status(500)
        .json({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
);

spaceRouter.post(
  "/questions/:questionId/updates",
  writeLimiter,
  requireHostAccess,
  async (req: Request, res: Response) => {
    try {
      const spaceId = res.locals.spaceId as number;
      const questionId = Number(req.params.questionId);
      if (!Number.isFinite(questionId)) {
        return res.status(400).json({ ok: false, error: "Invalid question id" });
      }
      const { title, body } = req.body as { title?: string; body?: string };
      if (!title || typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ ok: false, error: "title is required" });
      }
      if (!body || typeof body !== "string" || !body.trim()) {
        return res.status(400).json({ ok: false, error: "body is required" });
      }
      const created = await dataStore.addQuestionUpdate(spaceId, questionId, {
        title,
        body,
      });
      return res.json({ ok: true, update: created });
    } catch (e) {
      return res
        .status(500)
        .json({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
);

spaceRouter.get(
  "/questions/:questionId/comments",
  async (req: Request, res: Response) => {
    try {
      const spaceId = res.locals.spaceId as number;
      const questionId = Number(req.params.questionId);
      if (!Number.isFinite(questionId)) {
        return res.status(400).json({ ok: false, error: "Invalid question id" });
      }
      const list = await dataStore.listQuestionComments(spaceId, questionId);
      const ids = list.map((c) => c.id);
      const deviceId = parseDeviceId(req);
      const info = await dataStore.getCommentLikeInfo(spaceId, ids, deviceId);
      const enriched = list.map((c) => ({
        ...c,
        likeCount: info[c.id]?.count ?? 0,
        liked: info[c.id]?.liked ?? false,
      }));
      return res.json(enriched);
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
);

spaceRouter.post(
  "/questions/:questionId/comments/:commentId/like",
  writeLimiter,
  async (req: Request, res: Response) => {
    try {
      const spaceId = res.locals.spaceId as number;
      const questionId = Number(req.params.questionId);
      const commentId = Number(req.params.commentId);
      if (!Number.isFinite(questionId) || !Number.isFinite(commentId)) {
        return res.status(400).json({ ok: false, error: "Invalid id" });
      }
      const deviceId = parseDeviceId(req);
      if (!deviceId) {
        return res.status(400).json({
          ok: false,
          error: "Device id is required (header X-Space-Device or body deviceId)",
          code: "DEVICE_ID_REQUIRED",
        });
      }
      const result = await dataStore.toggleCommentLike(
        spaceId,
        questionId,
        commentId,
        deviceId
      );
      if (result.ok === false) {
        return res.status(404).json({ ok: false, error: "Comment not found" });
      }
      return res.json({
        ok: true,
        likes: result.count,
        liked: result.liked,
      });
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
);

spaceRouter.post(
  "/questions/:questionId/comments",
  writeLimiter,
  async (req: Request, res: Response) => {
    try {
      const spaceId = res.locals.spaceId as number;
      const questionId = Number(req.params.questionId);
      if (!Number.isFinite(questionId)) {
        return res.status(400).json({ ok: false, error: "Invalid question id" });
      }
      const q = await dataStore.getQuestionById(spaceId, questionId);
      if (!q) {
        return res.status(404).json({ ok: false, error: "Question not found" });
      }
      const { body, authorName } = req.body as {
        body?: string;
        authorName?: string;
      };
      if (typeof body !== "string" || !body.trim()) {
        return res.status(400).json({ ok: false, error: "body is required" });
      }
      const text = body.trim();
      if (text.length > 4000) {
        return res.status(400).json({ ok: false, error: "body is too long (max 4000)" });
      }
      let name: string | undefined;
      if (authorName != null) {
        if (typeof authorName !== "string") {
          return res.status(400).json({ ok: false, error: "authorName must be a string" });
        }
        const t = authorName.trim();
        if (t.length > 80) {
          return res.status(400).json({ ok: false, error: "authorName is too long (max 80)" });
        }
        name = t || undefined;
      }
      const created = await dataStore.addQuestionComment(spaceId, questionId, {
        body: text,
        authorName: name,
      });
      return res.json({ ok: true, comment: created });
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
);

function normalizeQuestionImageUrl(raw: unknown): string | undefined {
  if (raw === null || raw === "") return undefined;
  if (typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  if (s.length > 2048) return undefined;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:") return undefined;
    return s;
  } catch {
    return undefined;
  }
}

/** null/empty clears; max 2000 chars. */
function normalizeVoteMeaning(raw: unknown): string | undefined {
  if (raw === null || raw === "") return undefined;
  if (typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  if (s.length > 2000) return undefined;
  return s;
}

/** Short vote button copy; null/empty clears to use app defaults. Max 48 chars. */
function normalizeVoteButtonLabel(raw: unknown): string | undefined {
  if (raw === null || raw === "") return undefined;
  if (typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  return s.slice(0, 48);
}

spaceRouter.patch(
  "/questions/:questionId",
  writeLimiter,
  requireHostAccess,
  async (req: Request, res: Response) => {
    try {
      const spaceId = res.locals.spaceId as number;
      const questionId = Number(req.params.questionId);
      if (!Number.isFinite(questionId)) {
        return res.status(400).json({ ok: false, error: "Invalid question id" });
      }
      const body = req.body as {
        imageUrl?: unknown;
        yesMeans?: unknown;
        noMeans?: unknown;
        yesButtonLabel?: unknown;
        noButtonLabel?: unknown;
      };

      const updates: Partial<Omit<Question, "id" | "spaceId">> = {};

      if ("imageUrl" in body) {
        const imageUrl = normalizeQuestionImageUrl(body.imageUrl);
        if (body.imageUrl !== null && body.imageUrl !== "" && imageUrl === undefined) {
          return res.status(400).json({
            ok: false,
            error: "imageUrl must be an https URL or empty to clear",
          });
        }
        updates.imageUrl = imageUrl;
      }

      if ("yesMeans" in body) {
        const v = normalizeVoteMeaning(body.yesMeans);
        if (body.yesMeans !== null && body.yesMeans !== "" && v === undefined) {
          return res.status(400).json({
            ok: false,
            error: "yesMeans must be text (max 2000 characters) or empty to clear",
          });
        }
        updates.yesMeans = v;
      }

      if ("noMeans" in body) {
        const v = normalizeVoteMeaning(body.noMeans);
        if (body.noMeans !== null && body.noMeans !== "" && v === undefined) {
          return res.status(400).json({
            ok: false,
            error: "noMeans must be text (max 2000 characters) or empty to clear",
          });
        }
        updates.noMeans = v;
      }

      if ("yesButtonLabel" in body) {
        const v = normalizeVoteButtonLabel(body.yesButtonLabel);
        if (
          body.yesButtonLabel !== null &&
          body.yesButtonLabel !== "" &&
          v === undefined
        ) {
          return res.status(400).json({
            ok: false,
            error:
              "yesButtonLabel must be a short string (max 48 characters) or empty to clear",
          });
        }
        updates.yesButtonLabel = v;
      }

      if ("noButtonLabel" in body) {
        const v = normalizeVoteButtonLabel(body.noButtonLabel);
        if (
          body.noButtonLabel !== null &&
          body.noButtonLabel !== "" &&
          v === undefined
        ) {
          return res.status(400).json({
            ok: false,
            error:
              "noButtonLabel must be a short string (max 48 characters) or empty to clear",
          });
        }
        updates.noButtonLabel = v;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          ok: false,
          error:
            "Send at least one of: imageUrl, yesMeans, noMeans, yesButtonLabel, noButtonLabel",
        });
      }

      const updated = await dataStore.updateQuestion(spaceId, questionId, updates);
      if (!updated) {
        return res.status(404).json({ ok: false, error: "Question not found" });
      }
      return res.json({ ok: true, question: updated });
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
);

spaceRouter.get("/submissions", async (_req: Request, res: Response) => {
  const spaceId = res.locals.spaceId as number;
  res.json(await dataStore.getSubmissions(spaceId));
});

function normalizeBranding(input: unknown): Space["branding"] | undefined {
  if (input === null) return undefined;
  if (typeof input !== "object" || !input) return undefined;
  const obj = input as any;

  const rawLogo = typeof obj.logoUrl === "string" ? obj.logoUrl.trim() : "";
  let logoUrl: string | undefined = undefined;
  if (rawLogo) {
    if (rawLogo.length > 2048) return undefined;
    try {
      const u = new URL(rawLogo);
      if (u.protocol !== "https:") return undefined;
      logoUrl = rawLogo;
    } catch {
      return undefined;
    }
  }

  const rawAccent =
    typeof obj.accentColor === "string" ? obj.accentColor.trim() : "";
  const accentColor = rawAccent && rawAccent.length <= 64 ? rawAccent : undefined;

  if (!logoUrl && !accentColor) return undefined;
  return { logoUrl, accentColor };
}

spaceRouter.patch(
  "/branding",
  writeLimiter,
  requireHostAccess,
  async (req: Request, res: Response) => {
    try {
      const spaceId = res.locals.spaceId as number;
      const branding = normalizeBranding((req.body as any)?.branding);
      if ((req.body as any)?.branding != null && branding === undefined) {
        return res.status(400).json({
          ok: false,
          error: "branding must include a valid https logoUrl and/or accentColor",
        });
      }
      const updated = await dataStore.updateSpace(spaceId, { branding });
      if (!updated) {
        return res.status(404).json({ ok: false, error: "Space not found" });
      }
      return res.json({ ok: true, space: publicSpace(updated) });
    } catch (e) {
      return res
        .status(500)
        .json({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
);

spaceRouter.get("/insights", async (_req: Request, res: Response) => {
  try {
    const spaceId = res.locals.spaceId as number;
    const payload = await buildInsightsForSpace(spaceId);
    res.json(payload);
  } catch (error) {
    console.error("Insights route failed:", error);
    res.status(500).json({
      error: "Failed to generate insights",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

spaceRouter.get("/petitions", async (_req: Request, res: Response) => {
  try {
    const spaceId = res.locals.spaceId as number;
    const petitions = await dataStore.listPetitions(spaceId);
    const withCounts = await Promise.all(
      petitions.map(async (p) => {
        const sigs = await dataStore.getPetitionSignatures(spaceId, p.id);
        return { ...p, signatureCount: sigs.length };
      })
    );
    res.json(withCounts);
  } catch (e) {
    res.status(500).json({ ok: false, error: "Failed to load petitions" });
  }
});

spaceRouter.post(
  "/petitions",
  writeLimiter,
  requireHostAccess,
  async (req: Request, res: Response) => {
  try {
    const spaceId = res.locals.spaceId as number;
    const { title, description, goalSignatures } = req.body as {
      title?: string;
      description?: string;
      goalSignatures?: number;
    };
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ ok: false, error: "title is required" });
    }
    if (!description || typeof description !== "string" || !description.trim()) {
      return res.status(400).json({ ok: false, error: "description is required" });
    }
    const created = await dataStore.createPetition(spaceId, {
      title,
      description,
      goalSignatures:
        typeof goalSignatures === "number" && goalSignatures > 0
          ? Math.floor(goalSignatures)
          : undefined,
    });
    return res.json({ ok: true, petition: created });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Failed to create petition" });
  }
});

spaceRouter.post(
  "/petitions/:petitionId/sign",
  writeLimiter,
  async (req: Request, res: Response) => {
    try {
      const spaceId = res.locals.spaceId as number;
      const petitionId = Number(req.params.petitionId);
      if (!petitionId || Number.isNaN(petitionId)) {
        return res.status(400).json({ ok: false, error: "Invalid petitionId" });
      }
      const petition = await dataStore.getPetitionById(spaceId, petitionId);
      if (!petition) {
        return res.status(404).json({ ok: false, error: "Petition not found" });
      }
      const { name, email, country, town } = req.body as {
        name?: string;
        email?: string;
        country?: string;
        town?: string;
      };

      const sig = await dataStore.signPetition(spaceId, petitionId, {
        name: typeof name === "string" ? name : undefined,
        email: typeof email === "string" ? email : undefined,
        country: typeof country === "string" ? country : undefined,
        town: typeof town === "string" ? town : undefined,
      });

      const count = (await dataStore.getPetitionSignatures(spaceId, petitionId)).length;
      return res.json({ ok: true, signature: sig, signatureCount: count });
    } catch (e) {
      return res.status(500).json({ ok: false, error: "Failed to sign petition" });
    }
  }
);

spaceRouter.post("/submit", writeLimiter, async (req: Request, res: Response) => {
  try {
    const { text } = req.body as { text?: string };
    const spaceId = res.locals.spaceId as number;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        ok: false,
        error: "Submission text is required",
      });
    }

    const submission = await dataStore.addSubmission(spaceId, text.trim());
    scheduleClusteringAfterSubmission(spaceId);

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

spaceRouter.post("/vote", writeLimiter, async (req: Request, res: Response) => {
  try {
    const { questionId, vote, demographics } = req.body as {
      questionId?: number;
      vote?: "yes" | "no";
      demographics?: { gender?: string; ageRange?: string; country?: string; town?: string };
    };
    const spaceId = res.locals.spaceId as number;

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

    const deviceId = parseDeviceId(req);
    if (!deviceId) {
      return res.status(400).json({
        ok: false,
        error: "Device id is required (header X-Space-Device or body deviceId)",
        code: "DEVICE_ID_REQUIRED",
      });
    }

    const demo =
      demographics && typeof demographics === "object"
        ? {
            gender:
              typeof demographics.gender === "string" ? demographics.gender : undefined,
            ageRange:
              typeof demographics.ageRange === "string" ? demographics.ageRange : undefined,
            country:
              typeof demographics.country === "string" ? demographics.country : undefined,
            town: typeof demographics.town === "string" ? demographics.town : undefined,
          }
        : undefined;

    const result = await dataStore.submitQuestionVote(
      spaceId,
      questionId,
      deviceId,
      vote,
      demo
    );

    if (result.ok === false) {
      if (result.reason === "vote_change_limit") {
        return res.status(409).json({
          ok: false,
          error:
            "You have already changed your vote once for this question. Further changes are not allowed.",
          code: "VOTE_CHANGE_LIMIT",
        });
      }
      return res.status(404).json({
        ok: false,
        error: "Question not found",
      });
    }

    return res.json({
      ok: true,
      question: questionWithMyVotePayload(
        result.question,
        vote,
        result.canChangeVote
      ),
      voteStatus: result.status,
      previousVote: result.previousVote,
      canChangeVote: result.canChangeVote,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "Voting failed",
      details: String(error),
    });
  }
});

spaceRouter.get(
  "/export.csv",
  requireHostAccess,
  async (req: Request, res: Response) => {
    try {
      const spaceId = res.locals.spaceId as number;
      const space = res.locals.space as Space;
      const kind = String(req.query.kind || "votes").toLowerCase();

      let body = "";
      const bom = "\uFEFF";

      if (kind === "votes") {
        const events = await dataStore.getVoteEvents(spaceId);
        const questions = await dataStore.getQuestions(spaceId);
        const titleById = new Map(questions.map((q) => [q.id, q.title]));
        body +=
          csvLine([
            "event_id",
            "question_id",
            "question_title",
            "vote",
            "gender",
            "age_range",
            "country",
            "town",
            "created_at_ms",
          ]);
        for (const ev of events) {
          body += csvLine([
            ev.id,
            ev.questionId,
            titleById.get(ev.questionId) ?? "",
            ev.vote,
            ev.demographics?.gender,
            ev.demographics?.ageRange,
            ev.demographics?.country,
            ev.demographics?.town,
            ev.createdAt,
          ]);
        }
      } else if (kind === "questions") {
        const questions = await dataStore.getQuestions(spaceId);
        body += csvLine([
          "id",
          "title",
          "description",
          "yes_means",
          "no_means",
          "votes_yes",
          "votes_no",
          "cluster_id",
          "created_at_ms",
        ]);
        for (const q of questions) {
          body += csvLine([
            q.id,
            q.title,
            q.description,
            q.yesMeans,
            q.noMeans,
            q.votesYes,
            q.votesNo,
            q.clusterId,
            q.createdAt,
          ]);
        }
      } else if (kind === "submissions") {
        const submissions = await dataStore.getSubmissions(spaceId);
        body += csvLine([
          "id",
          "text",
          "clustered",
          "cluster_id",
          "created_at_ms",
        ]);
        for (const s of submissions) {
          body += csvLine([
            s.id,
            s.text,
            s.clustered ? "1" : "0",
            s.clusterId,
            s.createdAt,
          ]);
        }
      } else if (kind === "petitions") {
        const petitions = await dataStore.listPetitions(spaceId);
        body += csvLine([
          "id",
          "title",
          "description",
          "goal_signatures",
          "created_at_ms",
        ]);
        for (const p of petitions) {
          body += csvLine([
            p.id,
            p.title,
            p.description,
            p.goalSignatures,
            p.createdAt,
          ]);
        }
      } else if (kind === "petition_signatures" || kind === "signatures") {
        const petitions = await dataStore.listPetitions(spaceId);
        body += csvLine([
          "petition_id",
          "petition_title",
          "signature_id",
          "name",
          "email",
          "country",
          "town",
          "created_at_ms",
        ]);
        for (const p of petitions) {
          const sigs = await dataStore.getPetitionSignatures(spaceId, p.id);
          for (const sig of sigs) {
            body += csvLine([
              p.id,
              p.title,
              sig.id,
              sig.name,
              sig.email,
              sig.country,
              sig.town,
              sig.createdAt,
            ]);
          }
        }
      } else if (kind === "question_comments" || kind === "comments") {
        const questions = await dataStore.getQuestions(spaceId);
        const titleById = new Map(questions.map((q) => [q.id, q.title]));
        const comments = await dataStore.listQuestionCommentsForSpace(spaceId);
        body += csvLine([
          "comment_id",
          "question_id",
          "question_title",
          "author_name",
          "body",
          "created_at_ms",
        ]);
        for (const c of comments) {
          body += csvLine([
            c.id,
            c.questionId,
            titleById.get(c.questionId) ?? "",
            c.authorName,
            c.body,
            c.createdAt,
          ]);
        }
      } else if (kind === "vote_flips" || kind === "vote_changes") {
        const questions = await dataStore.getQuestions(spaceId);
        const titleById = new Map(questions.map((q) => [q.id, q.title]));
        const flips = await dataStore.listVoteFlipEvents(spaceId);
        body += csvLine([
          "flip_id",
          "question_id",
          "question_title",
          "from_vote",
          "to_vote",
          "ms_since_first_vote",
          "created_at_ms",
        ]);
        for (const f of flips) {
          body += csvLine([
            f.id,
            f.questionId,
            titleById.get(f.questionId) ?? "",
            f.fromVote,
            f.toVote,
            f.msSinceFirstVote,
            f.createdAt,
          ]);
        }
      } else {
        return res.status(400).json({
          ok: false,
          error:
            "Unknown kind. Use kind=votes|questions|submissions|petitions|petition_signatures|question_comments|vote_flips",
        });
      }

      const safeSlug = space.slug.replace(/[^a-zA-Z0-9_-]/g, "_");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeSlug}-${kind}.csv"`
      );
      res.send(bom + body);
    } catch (e) {
      res.status(500).json({
        ok: false,
        error: "Export failed",
        details: e instanceof Error ? e.message : String(e),
      });
    }
  }
);

spaceRouter.use("/admin", writeLimiter, adminRoutes);

app.use("/spaces/:slug", spaceRouter);

app.get("/questions", async (req: Request, res: Response) => {
  const sid = await openSpaceId();
  const deviceId = readDeviceIdForAttach(req);
  let questions = await dataStore.getQuestions(sid);
  questions = await attachDeviceVotesToQuestions(questions, sid, deviceId);
  res.json(questions);
});

/** Legacy open-space route (same pattern as /questions) — /api/trending */
app.get("/trending", async (_req: Request, res: Response) => {
  try {
    const sid = await openSpaceId();
    res.json(await getTrendingApiPayload(sid));
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
});

app.get("/submissions", async (_req: Request, res: Response) => {
  const sid = await openSpaceId();
  res.json(await dataStore.getSubmissions(sid));
});

app.get("/insights", async (_req: Request, res: Response) => {
  try {
    const sid = await openSpaceId();
    const payload = await buildInsightsForSpace(sid);
    res.json(payload);
  } catch (error) {
    console.error("Insights route failed:", error);
    res.status(500).json({
      error: "Failed to generate insights",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/submit", writeLimiter, async (req: Request, res: Response) => {
  try {
    const { text } = req.body as { text?: string };

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        ok: false,
        error: "Submission text is required",
      });
    }

    const sid = await openSpaceId();
    const submission = await dataStore.addSubmission(sid, text.trim());
    scheduleClusteringAfterSubmission(sid);

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

app.post("/vote", writeLimiter, async (req: Request, res: Response) => {
  try {
    const { questionId, vote, demographics } = req.body as {
      questionId?: number;
      vote?: "yes" | "no";
      demographics?: { gender?: string; ageRange?: string; country?: string; town?: string };
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

    const deviceId = parseDeviceId(req);
    if (!deviceId) {
      return res.status(400).json({
        ok: false,
        error: "Device id is required (header X-Space-Device or body deviceId)",
        code: "DEVICE_ID_REQUIRED",
      });
    }

    const sid = await openSpaceId();

    const demo =
      demographics && typeof demographics === "object"
        ? {
            gender:
              typeof demographics.gender === "string" ? demographics.gender : undefined,
            ageRange:
              typeof demographics.ageRange === "string" ? demographics.ageRange : undefined,
            country:
              typeof demographics.country === "string" ? demographics.country : undefined,
            town: typeof demographics.town === "string" ? demographics.town : undefined,
          }
        : undefined;

    const result = await dataStore.submitQuestionVote(sid, questionId, deviceId, vote, demo);

    if (result.ok === false) {
      if (result.reason === "vote_change_limit") {
        return res.status(409).json({
          ok: false,
          error:
            "You have already changed your vote once for this question. Further changes are not allowed.",
          code: "VOTE_CHANGE_LIMIT",
        });
      }
      return res.status(404).json({
        ok: false,
        error: "Question not found",
      });
    }

    return res.json({
      ok: true,
      question: questionWithMyVotePayload(
        result.question,
        vote,
        result.canChangeVote
      ),
      voteStatus: result.status,
      previousVote: result.previousVote,
      canChangeVote: result.canChangeVote,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "Voting failed",
      details: String(error),
    });
  }
});

app.use(
  "/admin",
  writeLimiter,
  async (_req, res, next) => {
    try {
      const sid = await openSpaceId();
      (res.locals as { spaceId: number }).spaceId = sid;
      next();
    } catch (e) {
      next(e);
    }
  },
  adminRoutes
);

export { app };

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
