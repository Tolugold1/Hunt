import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActionExecutorQueue } from "@/lib/queue";
import { z } from "zod";

const UpdateSchema = z.object({
  action: z.enum(["approve", "reject", "update-draft"]).optional(),
  coverLetter: z.string().optional(),
  emailSubject: z.string().optional(),
  mailboxId: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const application = await db.application.findFirst({
    where: { id, userId: session.user.id },
    include: { mailbox: { select: { email: true, provider: true } } },
  });

  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(application);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { id } = await params;
  const application = await db.application.findFirst({ where: { id, userId } });
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { action, coverLetter, emailSubject, mailboxId } = parsed.data;

  if (action === "approve") {
    if (!application.coverLetter && !coverLetter) {
      return NextResponse.json({ error: "No cover letter to send" }, { status: 400 });
    }

    const updated = await db.application.update({
      where: { id },
      data: {
        status: "APPROVED",
        ...(coverLetter ? { coverLetter } : {}),
        ...(emailSubject ? { emailSubject } : {}),
        ...(mailboxId ? { mailboxId } : {}),
      },
    });

    // Enqueue send
    if (application.applyType === "EMAIL") {
      const queue = getActionExecutorQueue();
      await queue.add(
        "send-email",
        { type: "send-email", applicationId: id, userId },
        { attempts: 3, backoff: { type: "exponential", delay: 10000 } }
      );
    }

    return NextResponse.json(updated);
  }

  if (action === "reject") {
    const updated = await db.application.update({
      where: { id },
      data: { status: "REJECTED_BY_USER" },
    });
    return NextResponse.json(updated);
  }

  if (action === "update-draft") {
    const updated = await db.application.update({
      where: { id },
      data: {
        ...(coverLetter ? { coverLetter } : {}),
        ...(emailSubject ? { emailSubject } : {}),
        ...(mailboxId ? { mailboxId } : {}),
      },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
