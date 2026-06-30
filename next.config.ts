import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "bullmq", "ioredis"],
};

export default nextConfig;
