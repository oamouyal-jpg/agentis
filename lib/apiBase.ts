/**
 * Base URL/path for API calls from the browser.
 *
 * - **`next dev` + default `"/api"`** — Next.js proxies `/api/*` to the Backend dev server
 *   (`http://127.0.0.1:4000` by default). Start Backend: `npm run dev:backend`.
 *
 * - **Default** `"/api"` — same origin as the combined `server.js` app (Render, local `node server.js`).
 * - **Production absolute URL** — often set to `https://your-app.onrender.com` **without** `/api`.
 *   That breaks all fetches; we append `/api` when the host is not localhost.
 * - **Local split dev** — `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` points at the
 *   Backend process directly (routes at `/submit`, not `/api/submit`). Do **not** append `/api`.
 */
function normalizeApiBase(raw: string | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return "/api";

  const noTrailing = s.replace(/\/+$/, "");

  if (noTrailing.startsWith("http://") || noTrailing.startsWith("https://")) {
    try {
      const u = new URL(noTrailing);
      const isLocal =
        u.hostname === "localhost" ||
        u.hostname === "127.0.0.1" ||
        u.hostname === "[::1]";
      if (isLocal) {
        return noTrailing;
      }
    } catch {
      /* ignore */
    }
    return noTrailing.endsWith("/api") ? noTrailing : `${noTrailing}/api`;
  }

  if (noTrailing === "/api" || noTrailing.endsWith("/api")) {
    return noTrailing.startsWith("/") ? noTrailing : `/${noTrailing}`;
  }

  if (noTrailing === "" || noTrailing === "/") {
    return "/api";
  }

  return noTrailing.startsWith("/") ? noTrailing : `/${noTrailing}`;
}

export const API_BASE = normalizeApiBase(process.env.NEXT_PUBLIC_API_BASE_URL);
