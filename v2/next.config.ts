import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Hooks use /api/v2/... prefix — rewrite to actual /api/... routes
      { source: "/api/v2/:path*", destination: "/api/:path*" },
    ];
  },
};

export default nextConfig;
