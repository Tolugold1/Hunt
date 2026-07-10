import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { extractApplyEmail, tweetTitle, EMOJI_RE } from "@/lib/job-discovery";
import { regenerateCoverLetter } from "@/lib/pipeline";
import type { ApplicationStatus } from "@prisma/client";

export const maxDuration = 300;

// Regeneration is LLM-heavy; process a small batch per request to stay under the
// serverless time limit and provider rate limits. The client loops until done.
const BATCH = 5;
const SEALED: ApplicationStatus[] = ["SENT", "APPROVED", "REPLIED", "INTERVIEW"];

/** Strip the link / "— via @handle on X" / emojis the old X fetcher appended. */
function cleanXDescription(desc: string): string {
  return desc
    .replace(/\n*🔗\s*\S+/g, " ")
    .replace(/\n*—\s*via\s+@\w+\s+on\s+X\b/gi, " ")
    .replace(EMOJI_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

const isDirty = (desc: string) =>
  /—\s*via\s+@\w+\s+on\s+X\b/i.test(desc) || desc.includes("🔗");

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  // Buggy X jobs are identifiable by the markers the old fetcher left in the
  // description. Cleaning removes those markers, so re-runs skip fixed rows.
  const candidates = await db.application.findMany({
    where: {
      userId,
      status: { notIn: SEALED },
      OR: [{ jobDescription: { contains: "on X" } }, { jobDescription: { contains: "🔗" } }],
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const dirty = candidates.filter((a) => isDirty(a.jobDescription ?? ""));
  const batch = dirty.slice(0, BATCH);

  if (!batch.length) {
    return NextResponse.json({ done: true, remaining: 0, fixed: 0, regenerated: 0, failed: 0 });
  }

  // Preload the hunts of this batch for clean, keyword-based titles.
  const huntIds = [...new Set(batch.map((a) => a.huntId).filter((x): x is string => !!x))];
  const hunts = huntIds.length
    ? await db.hunt.findMany({ where: { id: { in: huntIds } }, select: { id: true, keywords: true } })
    : [];
  const huntKw = new Map(hunts.map((h) => [h.id, h.keywords]));

  let fixed = 0;
  let regenerated = 0;
  let failed = 0;

  for (const app of batch) {
    try {
      const cleanDesc = cleanXDescription(app.jobDescription ?? "");
      const email = extractApplyEmail(cleanDesc);
      const keywords = app.huntId ? huntKw.get(app.huntId) ?? [] : [];
      const newTitle = tweetTitle(`${app.jobTitle} ${cleanDesc}`, keywords);

      await db.application.update({
        where: { id: app.id },
        data: {
          company: "Unknown", // the tweet author is the poster, not the employer
          jobTitle: newTitle,
          jobDescription: cleanDesc,
          applyType: email ? "EMAIL" : "LINK_OUT",
          applyEmail: email ?? null,
        },
      });
      fixed++;

      // Regenerate the letter + tailored résumé using the corrected fields.
      // Best-effort — a provider hiccup shouldn't undo the structural fix above.
      try {
        await regenerateCoverLetter(app.id, userId);
        regenerated++;
      } catch (err) {
        console.error(`[backfill] regenerate failed for ${app.id}:`, err);
      }
    } catch (err) {
      console.error(`[backfill] structural fix failed for ${app.id}:`, err);
      failed++;
    }
  }

  return NextResponse.json({
    done: dirty.length - batch.length <= 0,
    remaining: Math.max(0, dirty.length - batch.length),
    fixed,
    regenerated,
    failed,
  });
}
