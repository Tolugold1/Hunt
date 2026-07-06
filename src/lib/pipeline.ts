/**
 * Inline hunt pipeline — runs without BullMQ workers.
 * Used by Vercel cron, "Run now" fallback, and any serverless context.
 */

import { db } from "./db";
import { generateCoverLetter, scoreJobMatch, extractEmailSubject, tailorResume } from "./llm";
import { runJobDiscovery } from "./job-discovery";
import { sendJobApplicationEmail } from "./gmail";
import { getResumeBuffer } from "./storage";
import { renderResumePdf } from "./resume-pdf";
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

  // Honour a subject line the posting explicitly mandates; otherwise use the default.
  const requiredSubject = await extractEmailSubject({ jobDescription: application.jobDescription ?? "", provider });
  const subject =
    requiredSubject ??
    application.emailSubject ??
    `Application for ${application.jobTitle} — ${profile.fullName ?? ""}`.trim();

  // Tailor the résumé to this specific job (truthful — reorders/reweights only).
  let tailoredResume: string | null = null;
  try {
    tailoredResume = await tailorResume({
      jobTitle: application.jobTitle,
      company: application.company,
      jobDescription: application.jobDescription ?? "",
      resumeText: profile.resumeText,
      userName: profile.fullName ?? "Applicant",
      provider,
    });
  } catch (err) {
    console.error(`[pipeline] résumé tailoring failed for ${applicationId}:`, err);
  }

  await db.application.update({
    where: { id: applicationId },
    data: { coverLetter, emailSubject: subject, ...(tailoredResume ? { tailoredResume } : {}) },
  });

  console.log(`✓ Cover letter${tailoredResume ? " + tailored résumé" : ""} generated for ${applicationId}`);

  // Email-CV jobs go out automatically the moment the letter is ready — no
  // approval step. FORM / LINK_OUT jobs stay as drafts for the user to review.
  await maybeAutoSendEmailApplication(applicationId, userId);
}

/**
 * Auto-send an EMAIL-type application as soon as its cover letter is ready.
 * Uses the user's default mailbox (or first connected one). If no mailbox is
 * connected, it's left as a DRAFT so the user can connect one and send manually.
 * No-op for FORM / LINK_OUT jobs, which always require manual review.
 */
export async function maybeAutoSendEmailApplication(applicationId: string, userId: string): Promise<void> {
  const application = await db.application.findFirst({ where: { id: applicationId, userId } });
  if (!application) return;
  if (application.applyType !== "EMAIL") return; // only email-CV jobs auto-send
  if (application.status !== "DRAFT") return; // don't touch already sent/approved/rejected
  if (!application.coverLetter) return; // nothing to send yet
  if (!application.applyEmail) return; // no destination address

  // Pick a mailbox: one already set on the app, else the user's default, else the oldest.
  let mailboxId = application.mailboxId;
  if (!mailboxId) {
    const mailbox = await db.mailbox.findFirst({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    if (!mailbox) {
      console.warn(`[pipeline] ${applicationId}: no mailbox connected — leaving as DRAFT for manual send`);
      return;
    }
    mailboxId = mailbox.id;
  }

  await db.application.update({
    where: { id: applicationId },
    data: { status: "APPROVED", mailboxId },
  });

  try {
    await sendApplicationEmailInline(applicationId, userId);
    console.log(`✓ Auto-sent email application ${applicationId}`);
  } catch (err) {
    await db.application.update({
      where: { id: applicationId },
      data: { status: "FAILED", failureReason: err instanceof Error ? err.message : "Auto-send failed" },
    });
    console.error(`[pipeline] auto-send failed for ${applicationId}:`, err);
  }
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

  // Honour a subject line the posting explicitly mandates; otherwise use the default.
  const requiredSubject = await extractEmailSubject({ jobDescription: application.jobDescription ?? "", provider });
  const subject =
    requiredSubject ??
    application.emailSubject ??
    `Application for ${application.jobTitle} — ${profile.fullName ?? ""}`.trim();

  let tailoredResume: string | null = null;
  try {
    tailoredResume = await tailorResume({
      jobTitle: application.jobTitle,
      company: application.company,
      jobDescription: application.jobDescription ?? "",
      resumeText: profile.resumeText,
      userName: profile.fullName ?? "Applicant",
      provider,
    });
  } catch (err) {
    console.error(`[pipeline] résumé tailoring failed for ${applicationId}:`, err);
  }

  await db.application.update({
    where: { id: applicationId },
    // Reset to DRAFT so a previously stuck / failed / rejected item is reviewable again.
    data: {
      status: "DRAFT",
      matchScore: match.score,
      coverLetter,
      emailSubject: subject,
      failureReason: null,
      ...(tailoredResume ? { tailoredResume } : {}),
    },
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

  // Prefer the job-tailored résumé (rendered to PDF) over the original upload.
  const appWithResume = application as typeof application & { tailoredResume?: string | null };
  const resumeBuffer = appWithResume.tailoredResume
    ? await renderResumePdf(appWithResume.tailoredResume, profile.fullName ?? undefined)
    : await getResumeBuffer(profile.resumeUrl);
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
