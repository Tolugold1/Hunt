/**
 * Job Discovery Worker — listens for "run-hunt" jobs, scrapes RSS feeds,
 * creates DRAFT applications, then enqueues cover-letter generation.
 *
 * Run with: npx tsx workers/job-discovery.worker.ts
 */

import "dotenv/config";
import { Worker, Queue } from "bullmq";
import { db } from "../src/lib/db";
import { runJobDiscovery } from "../src/lib/job-discovery";
import { QUEUES, getConnection } from "../src/lib/queue";
import type { JobDiscoveryJobData } from "../src/lib/queue";
const connection = { ...getConnection(), maxRetriesPerRequest: null as null };
const generatorQueue = new Queue(QUEUES.GENERATOR, { connection });

const worker = new Worker<JobDiscoveryJobData>(
  QUEUES.JOB_DISCOVERY,
  async (job) => {
    const { huntId, userId } = job.data;

    const hunt = await db.hunt.findUnique({ where: { id: huntId } });
    if (!hunt) throw new Error(`Hunt ${huntId} not found`);
    if (!hunt.isActive) {
      console.log(`Skipping inactive hunt ${huntId}`);
      return;
    }

    console.log(`[job-discovery] Running hunt "${hunt.name}" (${huntId})`);

    const result = await runJobDiscovery(hunt);

    console.log(
      `[job-discovery] Hunt "${hunt.name}": fetched=${result.fetched} ` +
        `matched=${result.matched} created=${result.created} skipped=${result.skipped}`
    );

    await db.hunt.update({ where: { id: huntId }, data: { lastRunAt: new Date() } });

    // Enqueue cover-letter generation for each new application
    if (result.applicationIds.length > 0) {
      await Promise.all(
        result.applicationIds.map((applicationId) =>
          generatorQueue.add(
            "cover-letter",
            { type: "cover-letter", applicationId, userId },
            { attempts: 3, backoff: { type: "exponential", delay: 3000 } }
          )
        )
      );
      console.log(`[job-discovery] Queued ${result.applicationIds.length} cover-letter jobs`);
    }
  },
  { connection, concurrency: 3 }
);

worker.on("failed", (job, err) => {
  console.error(`✗ job-discovery job ${job?.id} failed:`, err.message);
});

worker.on("completed", (job) => {
  console.log(`✓ job-discovery job ${job.id} completed`);
});

process.on("SIGTERM", async () => {
  await worker.close();
  await generatorQueue.close();
});

console.log("Job-discovery worker started — listening for hunts...");
