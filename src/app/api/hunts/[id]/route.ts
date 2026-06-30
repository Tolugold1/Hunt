import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const UpdateHuntSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  location: z.string().optional(),
  remoteOnly: z.boolean().optional(),
  salaryMin: z.number().optional(),
  salaryCurrency: z.string().optional(),
  sources: z.array(z.string()).optional(),
  customSources: z.array(z.string()).optional(),
  topics: z.array(z.string()).optional(),
  platforms: z.array(z.string()).optional(),
  tone: z.string().optional(),
  maxActionsPerRun: z.number().optional(),
  approvalRequired: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const hunt = await db.hunt.findUnique({ where: { id } });
  if (!hunt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (hunt.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = UpdateHuntSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const updated = await db.hunt.update({ where: { id }, data: parsed.data });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const hunt = await db.hunt.findUnique({ where: { id } });
  if (!hunt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (hunt.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.hunt.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
