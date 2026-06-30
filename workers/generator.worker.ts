/**
 * Generator Worker — listens for "cover-letter" and "social-post" jobs,
 * calls Claude, and saves the draft back to the DB.
 *
 * Run with: npx tsx workers/generator.worker.ts
 */

import "dotenv/config";
import { Worker } from "bullmq";
import { db } from "../src/lib/db";
import { generateCoverLetter, generateSocialPost, scoreJobMatch } from "../src/lib/llm";
import { QUEUES, getConnection } from "../src/lib/queue";
import type { GeneratorJobData } from "../src/lib/queue";
const connection = { ...getConnection(), maxRetriesPerRequest: null as null };

const worker = new Worker<GeneratorJobData>(
  QUEUES.GENERATOR,
  async (job) => {
    if (job.data.type === "cover-letter") {
      const { applicationId, userId } = job.data;

      const [application, profile] = await Promise.all([
        db.application.findUnique({ where: { id: applicationId } }),
        db.profile.findUnique({ where: { userId } }),
      ]);

      if (!application || !profile?.resumeText) {
        throw new Error(`Missing data for application ${applicationId}`);
      }

      if (application.status !== "DRAFT") {
        console.log(`Skipping ${applicationId} — status is ${application.status}`);
        return;
      }

      // Score the match BEFORE generating a cover letter — saves tokens on bad matches
      const matchResult = await scoreJobMatch({
        jobDescription: application.jobDescription ?? "",
        resumeText: profile.resumeText,
        skills: (profile as typeof profile & { skills?: string[] }).skills ?? [],
        jobTitles: (profile as typeof profile & { jobTitles?: string[] }).jobTitles ?? [],
      });

      console.log(`[generator] ${applicationId} match score: ${matchResult.score} — ${matchResult.reason}`);

      // Auto-reject if clearly not a fit (score < 0.45)
      if (matchResult.score < 0.45) {
        await db.application.update({
          where: { id: applicationId },
          data: { status: "REJECTED_BY_USER", matchScore: matchResult.score },
        });
        console.log(`✗ Auto-rejected ${applicationId} (${application.jobTitle}) — score too low: ${matchResult.score}`);
        return;
      }

      await db.application.update({
        where: { id: applicationId },
        data: { matchScore: matchResult.score },
      });

      const coverLetter = await generateCoverLetter({
        jobTitle: application.jobTitle,
        company: application.company,
        jobDescription: application.jobDescription ?? "",
        resumeText: profile.resumeText,
        userName: profile.fullName ?? "Applicant",
      });

      const subject =
        application.emailSubject ??
        `Application for ${application.jobTitle} — ${profile.fullName ?? ""}`.trim();

      await db.application.update({
        where: { id: applicationId },
        data: { coverLetter, emailSubject: subject },
      });

      console.log(`✓ Cover letter generated for ${applicationId}`);
    }

    if (job.data.type === "social-post") {
      const { socialPostId, userId } = job.data;

      const [post, profile] = await Promise.all([
        db.socialPost.findUnique({ where: { id: socialPostId } }),
        db.profile.findUnique({ where: { userId } }),
      ]);

      if (!post) throw new Error(`Social post ${socialPostId} not found`);

      const content = await generateSocialPost({
        platform: post.platform,
        articleTitle: post.sourceTitle ?? "Interesting article",
        articleUrl: post.sourceUrl ?? "",
        articleSummary: post.content,
        tone: "professional",
        userName: profile?.fullName ?? "User",
      });

      await db.socialPost.update({
        where: { id: socialPostId },
        data: { content },
      });

      console.log(`✓ Social post generated for ${socialPostId}`);
    }
  },
  { connection, concurrency: 5 }
);

worker.on("failed", (job, err) => {
  console.error(`✗ Job ${job?.id} failed:`, err.message);
});

worker.on("completed", (job) => {
  console.log(`✓ Job ${job.id} completed`);
});

console.log("Generator worker started");
