import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { runJobDiscovery } from "@/lib/job-discovery";
import { getGeneratorQueue } from "@/lib/queue";

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

  // ── Step 1: Run job discovery inline (always — immediate results) ─────────
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

  // ── Step 2: Queue cover-letter generation for each new application ────────
  let coverLettersQueued = 0;
  let queueError: string | null = null;

  if (discovery.applicationIds.length > 0) {
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
    } catch (err) {
      // Redis not running — applications still exist, cover letters just won't
      // be auto-generated. Worker can be started separately.
      queueError =
        err instanceof Error && err.message.includes("ECONNREFUSED")
          ? "Redis not running — start it with: redis-server, then: npm run workers"
          : "Could not queue cover-letter generation";
      console.warn("[hunt/run] queue unavailable:", queueError);
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
