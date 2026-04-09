import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Render free tier often OOMs during `next build` typecheck; compile still runs.
  // Run `npx tsc --noEmit` locally before release.
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/submit", destination: "/s/open/submit", permanent: false },
      { source: "/admin", destination: "/s/open/admin", permanent: false },
      { source: "/insights", destination: "/s/open/insights", permanent: false },
      {
        source: "/questions/:id",
        destination: "/s/open/questions/:id",
        permanent: false,
      },
    ];
  },
  /**
   * `next dev` does not run `server.js`, so `/api` is not mounted. Proxy to the Backend
   * dev server (default port 4000). Run Backend in another terminal: `cd Backend && npm run dev`.
   * Production (`node server.js`) mounts `/api` on the same port — no proxy.
   */
  async rewrites() {
    if (process.env.NODE_ENV === "production") {
      return [];
    }
    if (process.env.DISABLE_API_PROXY === "1") {
      return [];
    }
    const target =
      process.env.BACKEND_DEV_PROXY_URL?.replace(/\/+$/, "") ||
      "http://127.0.0.1:4000";
    return [
      {
        source: "/api/:path*",
        destination: `${target}/:path*`,
      },
    ];
  },
};

export default nextConfig;
