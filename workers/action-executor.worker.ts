/**
 * Action Executor Worker — takes approved applications and sends the email.
 *
 * Run with: npx tsx workers/action-executor.worker.ts
 */

import "dotenv/config";
import { Worker } from "bullmq";
import { db } from "../src/lib/db";
import { sendJobApplicationEmail } from "../src/lib/gmail";
import { getResumeBuffer } from "../src/lib/storage";
import { QUEUES, getConnection } from "../src/lib/queue";
import type { ActionExecutorJobData } from "../src/lib/queue";
const connection = { ...getConnection(), maxRetriesPerRequest: null as null };

const worker = new Worker<ActionExecutorJobData>(
  QUEUES.ACTION_EXECUTOR,
  async (job) => {
    if (job.data.type === "send-email") {
      const { applicationId, userId } = job.data;

      const [application, profile] = await Promise.all([
        db.application.findUnique({
          where: { id: applicationId },
          include: { mailbox: true },
        }),
        db.profile.findUnique({ where: { userId } }),
      ]);

      if (!application) throw new Error(`Application ${applicationId} not found`);
      if (application.status !== "APPROVED") {
        console.log(`Skipping ${applicationId} — status is ${application.status}`);
        return;
      }
      if (!application.applyEmail) throw new Error("No apply email on application");
      if (!application.coverLetter) throw new Error("No cover letter on application");
      if (!application.mailbox) throw new Error("No mailbox linked to application");
      if (!profile?.resumeUrl) throw new Error("No resume URL on profile");

      // Get the resume file from storage
      const resumeBuffer = await getResumeBuffer(profile.resumeUrl);
      const resumeFilename = `${(profile.fullName ?? "resume").replace(/\s+/g, "-")}-cv.pdf`;

      const { messageId } = await sendJobApplicationEmail({
        mailbox: application.mailbox,
        to: application.applyEmail,
        subject: application.emailSubject ?? `Application for ${application.jobTitle}`,
        body: application.coverLetter,
        contact: {
          name: profile.fullName ?? "Applicant",
          email: application.mailbox.email,
          location: (profile as typeof profile & { location?: string | null }).location,
          phone: (profile as typeof profile & { phone?: string | null }).phone,
          linkedInUrl: (profile as typeof profile & { linkedInUrl?: string | null }).linkedInUrl,
          githubUrl: (profile as typeof profile & { githubUrl?: string | null }).githubUrl,
          portfolioUrl: (profile as typeof profile & { portfolioUrl?: string | null }).portfolioUrl,
        },
        resumeBuffer,
        resumeFilename,
      });

      await db.application.update({
        where: { id: applicationId },
        data: {
          status: "SENT",
          sentAt: new Date(),
          messageId,
        },
      });

      console.log(`✓ Email sent for application ${applicationId} → ${application.applyEmail}`);
    }
  },
  { connection, concurrency: 3 }
);

worker.on("failed", async (job, err) => {
  console.error(`✗ Job ${job?.id} failed:`, err.message);
  if (job?.data.type === "send-email") {
    await db.application
      .update({
        where: { id: job.data.applicationId },
        data: { status: "FAILED", failureReason: err.message },
      })
      .catch(() => {});
  }
});

console.log("Action executor worker started");
