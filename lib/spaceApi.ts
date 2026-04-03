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
  const base = `${API_BASE}/spaces/${encodeURIComponent(slug)}`;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export async function spaceFetch(
  slug: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
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
  return fetch(spaceUrl(slug, path), {
    ...init,
    headers,
  });
}
