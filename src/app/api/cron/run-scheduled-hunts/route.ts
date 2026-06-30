import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runHuntPipelineInline, isScheduleDue } from "@/lib/pipeline";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // Vercel sends Authorization: Bearer <CRON_SECRET> on all cron invocations.
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hunts = await db.hunt.findMany({
    where: { isActive: true, type: "JOB", NOT: { cronExpression: null } },
  });

  const due = hunts.filter((h) => isScheduleDue(h.cronExpression, h.lastRunAt));

  if (due.length === 0) {
    return NextResponse.json({ ran: 0, message: "No hunts due" });
  }

  const results: Array<{ huntId: string; name: string; created: number; errors: string[] }> = [];

  for (const hunt of due) {
    try {
      const result = await runHuntPipelineInline(hunt);
      results.push({ huntId: hunt.id, name: hunt.name, created: result.created, errors: result.errors });
      console.log(`[cron] Hunt "${hunt.name}": ${result.created} new drafts`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      results.push({ huntId: hunt.id, name: hunt.name, created: 0, errors: [msg] });
      console.error(`[cron] Hunt "${hunt.name}" failed:`, err);
    }
  }

  return NextResponse.json({ ran: results.length, results });
}
