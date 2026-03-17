import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure migration SQL files are bundled for Vercel serverless functions
  outputFileTracingIncludes: {
    "/api/kernel/migrate": ["./migrations/**/*.sql"],
  },
};

export default nextConfig;
