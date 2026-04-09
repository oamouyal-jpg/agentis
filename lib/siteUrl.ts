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
