import { API_BASE } from "./apiBase";
import { getOrCreateDeviceId } from "./deviceId";

const INVITE_PREFIX = "agentis-invite-";
const HOST_PREFIX = "agentis-host-";

export function storeInviteFromUrl(slug: string): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const inv = params.get("invite");
  if (inv) {
    sessionStorage.setItem(`${INVITE_PREFIX}${slug}`, inv);
  }
}

export function storeHostFromUrl(slug: string): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const host = params.get("host");
  if (host) {
    sessionStorage.setItem(`${HOST_PREFIX}${slug}`, host);
  }
}

export function getInviteForSpace(slug: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(`${INVITE_PREFIX}${slug}`);
}

export function getHostForSpace(slug: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(`${HOST_PREFIX}${slug}`);
}

export function spaceUrl(slug: string, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  // "open" is the legacy default space and uses unscoped routes (e.g. POST /submit).
  if (slug === "open") {
    return `${API_BASE}${p}`;
  }
  const base = `${API_BASE}/spaces/${encodeURIComponent(slug)}`;
  return `${base}${p}`;
}

/** Headers for space-scoped API calls (invite, host, device). */
export function buildSpaceRequestHeaders(
  slug: string,
  init?: RequestInit
): Headers {
  const invite = getInviteForSpace(slug);
  const host = getHostForSpace(slug);
  const headers = new Headers(init?.headers);
  if (invite) {
    headers.set("X-Space-Invite", invite);
  }
  if (host) {
    headers.set("X-Space-Host", host);
  }
  if (typeof window !== "undefined") {
    const device = getOrCreateDeviceId();
    if (device) {
      headers.set("X-Space-Device", device);
    }
  }
  return headers;
}

export async function spaceFetch(
  slug: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const headers = buildSpaceRequestHeaders(slug, init);
  return fetch(spaceUrl(slug, path), {
    ...init,
    headers,
    cache: init?.cache ?? "no-store",
  });
}

/** Community “what’s hot” + emerging topics — see Backend `trending.service.ts`. */
export type SpaceTrendingResponse = {
  ok: true;
  hot: {
    question: Record<string, unknown>;
    metrics: Record<string, unknown>;
  } | null;
  emerging: Array<{ question: Record<string, unknown>; metrics: Record<string, unknown> }>;
  hotUpdated: boolean;
  reason?: string;
};

export async function fetchSpaceTrending(slug: string): Promise<SpaceTrendingResponse> {
  // Always hit …/api/spaces/:slug/trending — do not use spaceUrl() for "open" (see spaceUrl).
  const url = `${API_BASE}/spaces/${encodeURIComponent(slug)}/trending`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: buildSpaceRequestHeaders(slug),
  });
  const text = await res.text();
  let data: (SpaceTrendingResponse & { ok?: boolean; error?: string }) | null = null;
  try {
    data = JSON.parse(text) as SpaceTrendingResponse & { ok?: boolean; error?: string };
  } catch {
    throw new Error(
      `Trending: expected JSON, got HTTP ${res.status}. Check NEXT_PUBLIC_API_BASE_URL includes /api (e.g. https://your-app.onrender.com/api).`
    );
  }
  if (!res.ok || data.ok !== true) {
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : `Trending failed (${res.status})`
    );
  }
  return data;
}
