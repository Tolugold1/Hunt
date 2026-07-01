/**
 * Inline hunt pipeline — runs without BullMQ workers.
 * Used by Vercel cron, "Run now" fallback, and any serverless context.
 */

import { db } from "./db";
import { generateCoverLetter, scoreJobMatch } from "./llm";
import { runJobDiscovery } from "./job-discovery";
import { sendJobApplicationEmail } from "./gmail";
import { getResumeBuffer } from "./storage";
import type { Hunt } from "@prisma/client";

/** Generate a cover letter for a single DRAFT application. */
export async function generateApplicationDraft(applicationId: string, userId: string): Promise<void> {
  const [application, profile] = await Promise.all([
    db.application.findUnique({ where: { id: applicationId } }),
    db.profile.findUnique({ where: { userId } }),
  ]);

  if (!application || !profile?.resumeText) {
    console.warn(`[pipeline] Missing data for application ${applicationId}`);
    return;
  }

  if (application.status !== "DRAFT") {
    console.log(`[pipeline] Skipping ${applicationId} — status is ${application.status}`);
    return;
  }

  const profileWithArrays = profile as typeof profile & { skills?: string[]; jobTitles?: string[]; aiProvider?: string };
  const provider = profileWithArrays.aiProvider ?? null;

  const matchResult = await scoreJobMatch({
    jobDescription: application.jobDescription ?? "",
    resumeText: profile.resumeText,
    skills: profileWithArrays.skills ?? [],
    jobTitles: profileWithArrays.jobTitles ?? [],
    provider,
  });

  console.log(`[pipeline] ${applicationId} score: ${matchResult.score} — ${matchResult.reason}`);

  if (matchResult.score < 0.45) {
    await db.application.update({
      where: { id: applicationId },
      data: { status: "REJECTED_BY_USER", matchScore: matchResult.score },
    });
    console.log(`✗ Auto-rejected ${applicationId} (score ${matchResult.score})`);
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
    provider,
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

/** Statuses where a cover letter is locked — regeneration is not allowed. */
const SEALED_STATUSES = ["SENT", "APPROVED", "REPLIED", "INTERVIEW"];

/**
 * User-initiated (re)generation of a cover letter. Unlike generateApplicationDraft,
 * this never auto-rejects on a low match score and always produces a letter — it's
 * the recovery path for drafts stuck on "Generating…", failed generations, or when
 * the user switches AI provider. Blocked once the application has been sent.
 */
export async function regenerateCoverLetter(applicationId: string, userId: string): Promise<void> {
  const [application, profile] = await Promise.all([
    db.application.findFirst({ where: { id: applicationId, userId } }),
    db.profile.findUnique({ where: { userId } }),
  ]);

  if (!application) throw new Error("Application not found");
  if (!profile?.resumeText) throw new Error("Upload your resume before generating a cover letter.");
  if (SEALED_STATUSES.includes(application.status)) {
    throw new Error(`Can't regenerate — this application is already ${application.status.toLowerCase()}.`);
  }

  const profileWithArrays = profile as typeof profile & { skills?: string[]; jobTitles?: string[]; aiProvider?: string };
  const provider = profileWithArrays.aiProvider ?? null;

  const match = await scoreJobMatch({
    jobDescription: application.jobDescription ?? "",
    resumeText: profile.resumeText,
    skills: profileWithArrays.skills ?? [],
    jobTitles: profileWithArrays.jobTitles ?? [],
    provider,
  });

  const coverLetter = await generateCoverLetter({
    jobTitle: application.jobTitle,
    company: application.company,
    jobDescription: application.jobDescription ?? "",
    resumeText: profile.resumeText,
    userName: profile.fullName ?? "Applicant",
    provider,
  });

  const subject =
    application.emailSubject ??
    `Application for ${application.jobTitle} — ${profile.fullName ?? ""}`.trim();

  await db.application.update({
    where: { id: applicationId },
    // Reset to DRAFT so a previously stuck / failed / rejected item is reviewable again.
    data: { status: "DRAFT", matchScore: match.score, coverLetter, emailSubject: subject, failureReason: null },
  });
}

/** Full hunt pipeline: discovery → cover letters, inline (no queue). */
export async function runHuntPipelineInline(hunt: Hunt): Promise<{
  fetched: number;
  matched: number;
  created: number;
  skipped: number;
  sources: string[];
  errors: string[];
  coverLettersGenerated: number;
}> {
  const discovery = await runJobDiscovery(hunt);

  await db.hunt.update({ where: { id: hunt.id }, data: { lastRunAt: new Date() } });

  let coverLettersGenerated = 0;
  for (const applicationId of discovery.applicationIds) {
    try {
      await generateApplicationDraft(applicationId, hunt.userId);
      coverLettersGenerated++;
    } catch (err) {
      console.error(`[pipeline] cover letter failed for ${applicationId}:`, err);
    }
  }

  return {
    fetched: discovery.fetched,
    matched: discovery.matched,
    created: discovery.created,
    skipped: discovery.skipped,
    sources: discovery.sources,
    errors: discovery.errors,
    coverLettersGenerated,
  };
}

/** Check if a hunt's schedule is due to run. cronExpression format: "6h", "12h", "24h", "168h" */
export function isScheduleDue(cronExpression: string | null, lastRunAt: Date | null): boolean {
  if (!cronExpression) return false;
  const m = cronExpression.match(/^(\d+)h$/);
  if (!m) return false;
  const intervalMs = parseInt(m[1]) * 60 * 60 * 1000;
  if (!lastRunAt) return true;
  return Date.now() - lastRunAt.getTime() >= intervalMs;
}

/** Send an APPROVED application's email inline — no BullMQ worker needed. */
export async function sendApplicationEmailInline(applicationId: string, userId: string): Promise<void> {
  const [application, profile] = await Promise.all([
    db.application.findUnique({ where: { id: applicationId }, include: { mailbox: true } }),
    db.profile.findUnique({ where: { userId } }),
  ]);

  if (!application) throw new Error(`Application ${applicationId} not found`);
  if (application.status !== "APPROVED") return;
  if (!application.applyEmail) throw new Error("No apply email on application");
  if (!application.coverLetter) throw new Error("No cover letter on application");
  if (!application.mailbox) throw new Error("No mailbox linked to application");
  if (!profile?.resumeUrl) throw new Error("No resume on profile");

  const resumeBuffer = await getResumeBuffer(profile.resumeUrl);
  const resumeFilename = `${(profile.fullName ?? "resume").replace(/\s+/g, "-")}-cv.pdf`;

  const profileExt = profile as typeof profile & {
    location?: string | null;
    phone?: string | null;
    linkedInUrl?: string | null;
    githubUrl?: string | null;
    portfolioUrl?: string | null;
  };

  const { messageId } = await sendJobApplicationEmail({
    mailbox: application.mailbox,
    to: application.applyEmail,
    subject: application.emailSubject ?? `Application for ${application.jobTitle}`,
    body: application.coverLetter,
    contact: {
      name: profile.fullName ?? "Applicant",
      email: application.mailbox.email,
      location: profileExt.location,
      phone: profileExt.phone,
      linkedInUrl: profileExt.linkedInUrl,
      githubUrl: profileExt.githubUrl,
      portfolioUrl: profileExt.portfolioUrl,
    },
    resumeBuffer,
    resumeFilename,
  });

  await db.application.update({
    where: { id: applicationId },
    data: { status: "SENT", sentAt: new Date(), messageId },
  });

  console.log(`✓ Email sent inline for ${applicationId}`);
}

/** Human-readable label for a cronExpression. */
export function scheduleLabel(cronExpression: string | null | undefined): string {
  if (!cronExpression) return "Manual only";
  const map: Record<string, string> = {
    "6h": "Every 6 hours",
    "12h": "Twice a day",
    "24h": "Daily",
    "168h": "Weekly",
  };
  return map[cronExpression] ?? cronExpression;
}
