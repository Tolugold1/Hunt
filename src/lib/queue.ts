import { Queue } from "bullmq";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

// Parse the Redis URL into host/port/password for BullMQ
function parseRedisUrl(url: string) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname || "localhost",
      port: Number(u.port) || 6379,
      password: u.password || undefined,
      db: u.pathname ? Number(u.pathname.slice(1)) || 0 : 0,
    };
  } catch {
    return { host: "localhost", port: 6379 };
  }
}

export function getConnection() {
  return parseRedisUrl(REDIS_URL);
}

export const QUEUES = {
  JOB_DISCOVERY: "job-discovery",
  GENERATOR: "generator",
  ACTION_EXECUTOR: "action-executor",
  SOCIAL_DISCOVERY: "social-discovery",
} as const;

export type GeneratorJobData =
  | { type: "cover-letter"; applicationId: string; userId: string }
  | { type: "social-post"; socialPostId: string; userId: string };

export type ActionExecutorJobData =
  | { type: "send-email"; applicationId: string; userId: string }
  | { type: "publish-post"; socialPostId: string; userId: string };

export type JobDiscoveryJobData = {
  huntId: string;
  userId: string;
};

export function getGeneratorQueue() {
  return new Queue(QUEUES.GENERATOR, { connection: getConnection() });
}

export function getActionExecutorQueue() {
  return new Queue(QUEUES.ACTION_EXECUTOR, { connection: getConnection() });
}

export function getJobDiscoveryQueue() {
  return new Queue(QUEUES.JOB_DISCOVERY, { connection: getConnection() });
}
