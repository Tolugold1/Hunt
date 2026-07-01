import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "bullmq", "ioredis", "googleapis", "google-auth-library", "nodemailer"],
};

export default nextConfig;
