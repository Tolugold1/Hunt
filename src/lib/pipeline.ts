/**
 * Inline hunt pipeline — runs without BullMQ workers.
 * Used by Vercel cron, "Run now" fallback, and any serverless context.
 */

import { db } from "./db";
import { generateCoverLetter, scoreJobMatch } from "./llm";
import { runJobDiscovery } from "./job-discovery";
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

  const profileWithArrays = profile as typeof profile & { skills?: string[]; jobTitles?: string[] };

  const matchResult = await scoreJobMatch({
    jobDescription: application.jobDescription ?? "",
    resumeText: profile.resumeText,
    skills: profileWithArrays.skills ?? [],
    jobTitles: profileWithArrays.jobTitles ?? [],
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
