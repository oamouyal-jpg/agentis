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
};

export default nextConfig;
