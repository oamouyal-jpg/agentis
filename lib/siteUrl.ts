/** Canonical site origin for Open Graph and absolute URLs (set in production). */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";

/**
 * One stable string for the same page (e.g. `http://localhost:3000` vs `http://localhost:3000/`).
 * Use for share links so SSR and the first client paint match (hydration-safe).
 */
export function canonicalPublicUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return SITE_URL;
  try {
    const u = new URL(s);
    if (u.pathname === "/" && !u.search && !u.hash) {
      return u.origin;
    }
    return s;
  } catch {
    return s.replace(/\/$/, "") || SITE_URL;
  }
}

function isLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

/**
 * WhatsApp / social shares must not use a localhost origin from a mis-set
 * `NEXT_PUBLIC_SITE_URL` when the user is on a public site. Prefer the real
 * tab URL when `explicit` is missing; if `explicit` points at loopback but the
 * tab is public, rewrite the origin to match the browser.
 */
export function resolveShareUrl(pageHref: string, explicit?: string): string {
  const here = canonicalPublicUrl(pageHref);
  if (!explicit) return here;
  try {
    const want = new URL(explicit);
    const tab = new URL(pageHref);
    if (isLoopbackHost(want.hostname) && !isLoopbackHost(tab.hostname)) {
      return `${tab.origin}${want.pathname}${want.search}${want.hash}`;
    }
    return canonicalPublicUrl(explicit);
  } catch {
    return here;
  }
}
