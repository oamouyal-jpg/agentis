import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
