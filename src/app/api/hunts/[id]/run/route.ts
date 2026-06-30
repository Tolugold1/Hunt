import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getJobDiscoveryQueue } from "@/lib/queue";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const hunt = await db.hunt.findUnique({ where: { id } });

  if (!hunt) return NextResponse.json({ error: "Hunt not found" }, { status: 404 });
  if (hunt.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const queue = getJobDiscoveryQueue();
    await queue.add("run-hunt", { huntId: hunt.id, userId: hunt.userId }, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    });

    await db.hunt.update({ where: { id }, data: { lastRunAt: new Date() } });

    return NextResponse.json({ queued: true });
  } catch (err) {
    // Redis not running — return a clear dev message
    const isConnErr =
      err instanceof Error &&
      (err.message.includes("ECONNREFUSED") || err.message.includes("connect"));

    if (isConnErr) {
      return NextResponse.json(
        { error: "Redis is not running. Start it with: redis-server\nThen run: npm run workers" },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: "Failed to queue hunt" }, { status: 500 });
  }
}
