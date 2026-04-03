import { NextFunction, Request, Response } from "express";
import type { Space } from "../store/spaceTypes";
import { dataStore } from "../store/store";

export async function loadSpaceBySlug(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const slug = req.params.slug;
    if (!slug || typeof slug !== "string") {
      res.status(400).json({ error: "Missing slug" });
      return;
    }

    await dataStore.ensureDefaultSpace();
    const space = await dataStore.getSpaceBySlug(slug);
    if (!space) {
      res.status(404).json({ error: "Space not found" });
      return;
    }

    res.locals.space = space;
    res.locals.spaceId = space.id;
    next();
  } catch (e) {
    next(e);
  }
}

function readInviteToken(req: Request): string | undefined {
  const q = req.query.invite;
  if (typeof q === "string" && q) return q;
  const h = req.headers["x-space-invite"];
  if (typeof h === "string" && h) return h;
  const body = req.body as { invite?: string } | undefined;
  if (body && typeof body.invite === "string" && body.invite) return body.invite;
  return undefined;
}

function readHostToken(req: Request): string | undefined {
  const q = req.query.host;
  if (typeof q === "string" && q) return q;
  const h = req.headers["x-space-host"];
  if (typeof h === "string" && h) return h;
  const body = req.body as { host?: string } | undefined;
  if (body && typeof body.host === "string" && body.host) return body.host;
  return undefined;
}

export function requireSpaceAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const space = res.locals.space as Space | undefined;
  if (!space) {
    res.status(500).json({ error: "Space not loaded" });
    return;
  }

  if (space.visibility === "public") {
    next();
    return;
  }

  const hostTok = readHostToken(req);
  if (hostTok && space.hostSecret && hostTok === space.hostSecret) {
    next();
    return;
  }

  const token = readInviteToken(req);
  if (token && space.inviteSecret && token === space.inviteSecret) {
    next();
    return;
  }

  res.status(403).json({
    error: "Members only",
    code: "MEMBERS_ONLY",
    hint: "Open the invite link or send header X-Space-Invite with your invite token.",
  });
}

export function requireHostAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const space = res.locals.space as Space | undefined;
  if (!space) {
    res.status(500).json({ error: "Space not loaded" });
    return;
  }
  const token = readHostToken(req);
  if (token && space.hostSecret && token === space.hostSecret) {
    next();
    return;
  }
  res.status(403).json({
    error: "Host only",
    code: "HOST_ONLY",
    hint: "Open the host link or send header X-Space-Host with your host token.",
  });
}
