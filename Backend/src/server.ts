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
import { dataStore } from "./store/store";
import type { Space } from "./store/spaceTypes";
import { loadSpaceBySlug, requireSpaceAccess } from "./middleware/spaceContext";
import { buildInsightsForSpace } from "./services/buildInsights";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.set("trust proxy", 1);

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
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

function publicSpace(space: Space) {
  return {
    id: space.id,
    name: space.name,
    slug: space.slug,
    description: space.description,
    visibility: space.visibility,
    membersOnly: space.visibility === "members_only",
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

const spaceRouter = express.Router({ mergeParams: true });
spaceRouter.use(loadSpaceBySlug);
spaceRouter.use(requireSpaceAccess);

spaceRouter.get("/questions", async (_req: Request, res: Response) => {
  const spaceId = res.locals.spaceId as number;
  res.json(await dataStore.getQuestions(spaceId));
});

spaceRouter.get("/submissions", async (_req: Request, res: Response) => {
  const spaceId = res.locals.spaceId as number;
  res.json(await dataStore.getSubmissions(spaceId));
});

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
    const { questionId, vote } = req.body as {
      questionId?: number;
      vote?: "yes" | "no";
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

    const updatedQuestion = await dataStore.voteOnQuestion(spaceId, questionId, vote);

    if (!updatedQuestion) {
      return res.status(404).json({
        ok: false,
        error: "Question not found",
      });
    }

    return res.json({
      ok: true,
      question: updatedQuestion,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "Voting failed",
      details: String(error),
    });
  }
});

spaceRouter.use("/admin", writeLimiter, adminRoutes);

app.use("/spaces/:slug", spaceRouter);

app.get("/questions", async (_req: Request, res: Response) => {
  const sid = await openSpaceId();
  res.json(await dataStore.getQuestions(sid));
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
    const { questionId, vote } = req.body as {
      questionId?: number;
      vote?: "yes" | "no";
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

    const sid = await openSpaceId();
    const updatedQuestion = await dataStore.voteOnQuestion(sid, questionId, vote);

    if (!updatedQuestion) {
      return res.status(404).json({
        ok: false,
        error: "Question not found",
      });
    }

    return res.json({
      ok: true,
      question: updatedQuestion,
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
