/** Canonical site origin for Open Graph and absolute URLs (set in production). */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
