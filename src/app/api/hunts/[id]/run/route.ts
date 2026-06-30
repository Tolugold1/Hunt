import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { runJobDiscovery } from "@/lib/job-discovery";
import { generateApplicationDraft } from "@/lib/pipeline";
import { getGeneratorQueue } from "@/lib/queue";

export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const hunt = await db.hunt.findUnique({ where: { id } });
  if (!hunt) return NextResponse.json({ error: "Hunt not found" }, { status: 404 });
  if (hunt.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (hunt.type !== "JOB") {
    return NextResponse.json({ error: "Social hunts not yet supported for manual runs" }, { status: 400 });
  }

  // ── Step 1: Run job discovery inline ─────────────────────────────────────
  let discovery;
  try {
    discovery = await runJobDiscovery(hunt);
  } catch (err) {
    console.error("[hunt/run] discovery error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Job discovery failed" },
      { status: 500 }
    );
  }

  await db.hunt.update({ where: { id }, data: { lastRunAt: new Date() } });

  if (discovery.applicationIds.length === 0) {
    return NextResponse.json({
      success: true,
      fetched: discovery.fetched,
      matched: discovery.matched,
      created: 0,
      skipped: discovery.skipped,
      sources: discovery.sources,
      errors: discovery.errors,
      coverLettersQueued: 0,
      queueError: null,
    });
  }

  // ── Step 2: Try BullMQ first, fall back to inline generation ─────────────
  let coverLettersQueued = 0;
  let queueError: string | null = null;

  try {
    const queue = getGeneratorQueue();
    await Promise.all(
      discovery.applicationIds.map((applicationId) =>
        queue.add(
          "cover-letter",
          { type: "cover-letter", applicationId, userId: hunt.userId },
          { attempts: 3, backoff: { type: "exponential", delay: 3000 } }
        )
      )
    );
    coverLettersQueued = discovery.applicationIds.length;
  } catch {
    // Redis not running — generate inline (works on Vercel without workers)
    console.log("[hunt/run] BullMQ unavailable — generating cover letters inline");
    for (const applicationId of discovery.applicationIds) {
      try {
        await generateApplicationDraft(applicationId, hunt.userId);
        coverLettersQueued++;
      } catch (err) {
        console.error(`[hunt/run] inline cover letter failed for ${applicationId}:`, err);
      }
    }
  }

  return NextResponse.json({
    success: true,
    fetched: discovery.fetched,
    matched: discovery.matched,
    created: discovery.created,
    skipped: discovery.skipped,
    sources: discovery.sources,
    errors: discovery.errors,
    coverLettersQueued,
    queueError,
  });
}
