import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendApplicationEmailInline, regenerateCoverLetter } from "@/lib/pipeline";
import { z } from "zod";

export const maxDuration = 60;

const UpdateSchema = z.object({
  action: z.enum(["approve", "reject", "update-draft", "retry", "regenerate"]).optional(),
  coverLetter: z.string().optional(),
  emailSubject: z.string().optional(),
  mailboxId: z.string().optional(),
  tailoredResume: z.string().optional(),
});

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const application = await db.application.findFirst({ where: { id, userId: session.user.id } });
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.application.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}

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

  const { action, coverLetter, emailSubject, mailboxId, tailoredResume } = parsed.data;

  if (action === "approve") {
    if (!application.coverLetter && !coverLetter) {
      return NextResponse.json({ error: "No cover letter to send" }, { status: 400 });
    }

    if (application.applyType === "LINK_OUT") {
      // User applies manually on the company site — mark as sent immediately
      const updated = await db.application.update({
        where: { id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          ...(coverLetter ? { coverLetter } : {}),
          ...(emailSubject ? { emailSubject } : {}),
        },
      });
      return NextResponse.json(updated);
    }

    // EMAIL type — enqueue for automatic sending
    if (!mailboxId) {
      return NextResponse.json({ error: "Select a mailbox to send from" }, { status: 400 });
    }

    // Mark APPROVED (sendApplicationEmailInline requires it), then send right away.
    await db.application.update({
      where: { id },
      data: {
        status: "APPROVED",
        ...(coverLetter ? { coverLetter } : {}),
        ...(emailSubject ? { emailSubject } : {}),
        ...(mailboxId ? { mailboxId } : {}),
      },
    });

    // Send immediately — never queue. Vercel cron is daily-only and no worker
    // runs there, so a queued send would never go out. Report the result now.
    try {
      await sendApplicationEmailInline(id, userId);
      const sent = await db.application.findUnique({ where: { id } });
      return NextResponse.json(sent);
    } catch (sendErr) {
      await db.application.update({
        where: { id },
        data: { status: "FAILED", failureReason: sendErr instanceof Error ? sendErr.message : "Send failed" },
      });
      return NextResponse.json({ error: sendErr instanceof Error ? sendErr.message : "Send failed" }, { status: 500 });
    }
  }

  if (action === "retry") {
    if (!application.applyEmail) return NextResponse.json({ error: "No apply email" }, { status: 400 });
    if (!application.coverLetter) return NextResponse.json({ error: "No cover letter" }, { status: 400 });
    if (!application.mailboxId) return NextResponse.json({ error: "No mailbox selected" }, { status: 400 });

    await db.application.update({
      where: { id },
      data: { status: "APPROVED", failureReason: null },
    });

    // Send immediately — never queue (see note in the approve action above).
    try {
      await sendApplicationEmailInline(id, userId);
      const sent = await db.application.findUnique({ where: { id } });
      return NextResponse.json(sent);
    } catch (sendErr) {
      await db.application.update({
        where: { id },
        data: { status: "FAILED", failureReason: sendErr instanceof Error ? sendErr.message : "Send failed" },
      });
      return NextResponse.json({ error: sendErr instanceof Error ? sendErr.message : "Send failed" }, { status: 500 });
    }
  }

  if (action === "regenerate") {
    try {
      await regenerateCoverLetter(id, userId);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to regenerate cover letter" },
        { status: 400 }
      );
    }
    const updated = await db.application.findUnique({ where: { id } });
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
        ...(tailoredResume !== undefined ? { tailoredResume } : {}),
      },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
