import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const CreateHuntSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["JOB", "SOCIAL"]).default("JOB"),
  keywords: z.array(z.string()).default([]),
  location: z.string().optional(),
  remoteOnly: z.boolean().default(false),
  salaryMin: z.number().optional(),
  salaryCurrency: z.string().default("USD"),
  sources: z.array(z.string()).default(["email-apply"]),
  topics: z.array(z.string()).default([]),
  platforms: z.array(z.string()).default([]),
  tone: z.string().default("professional"),
  cronExpression: z.string().optional(),
  maxActionsPerRun: z.number().default(10),
  approvalRequired: z.boolean().default(true),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hunts = await db.hunt.findMany({
    where: { userId: session.user.id },
    include: {
      _count: { select: { applications: true, socialPosts: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(hunts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = CreateHuntSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const hunt = await db.hunt.create({
      data: { userId: session.user.id, ...parsed.data },
    });
    return NextResponse.json(hunt, { status: 201 });
  } catch (err) {
    console.error("[POST /api/hunts]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Database error" },
      { status: 500 }
    );
  }
}
