import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getGeneratorQueue } from "@/lib/queue";
import { regenerateCoverLetter, maybeAutoSendEmailApplication } from "@/lib/pipeline";
import { z } from "zod";

// Cover-letter generation runs inline when no Redis worker is available.
export const maxDuration = 60;

const CreateApplicationSchema = z.object({
  jobTitle: z.string().min(1),
  company: z.string().min(1),
  jobUrl: z.string().url().optional(),
  jobDescription: z.string().min(1),
  applyEmail: z.string().email().optional(),
  source: z.string().default("manual"),
  huntId: z.string().optional(),
  applyType: z.enum(["EMAIL", "FORM", "LINK_OUT"]).default("EMAIL"),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const applications = await db.application.findMany({
    where: {
      userId: session.user.id,
      ...(status ? { status: status as never } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(applications);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = await req.json();
  const parsed = CreateApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile?.resumeText) {
    return NextResponse.json(
      { error: "Please upload your resume before creating applications." },
      { status: 400 }
    );
  }

  const application = await db.application.create({
    data: {
      userId,
      ...parsed.data,
      status: "DRAFT",
    },
  });

  // Generate the cover letter draft. Prefer the BullMQ worker when Redis is
  // configured (local dev); otherwise generate inline so the draft doesn't sit
  // stuck on "Generating…" on Vercel, where no worker runs.
  async function generateInline() {
    try {
      await regenerateCoverLetter(application.id, userId);
    } catch (err) {
      console.error("[applications] inline generation failed:", err);
      // Record why so the UI can offer "Regenerate" immediately instead of
      // spinning. Stays DRAFT with no cover letter.
      await db.application.update({
        where: { id: application.id },
        data: { failureReason: err instanceof Error ? err.message : "Cover letter generation failed" },
      }).catch(() => {});
    }
  }

  if (process.env.REDIS_URL) {
    try {
      const queue = getGeneratorQueue();
      await queue.add(
        "cover-letter",
        { type: "cover-letter", applicationId: application.id, userId },
        { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
      );
    } catch {
      await generateInline();
    }
  } else {
    await generateInline();
  }

  // Email-CV jobs send automatically once the letter exists (no-op for FORM /
  // LINK_OUT, or when generation was deferred to a worker / failed).
  await maybeAutoSendEmailApplication(application.id, userId);

  const fresh = await db.application.findUnique({ where: { id: application.id } });
  return NextResponse.json(fresh ?? application, { status: 201 });
}
