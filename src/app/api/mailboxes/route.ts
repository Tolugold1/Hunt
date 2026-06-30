import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import nodemailer from "nodemailer";
import { z } from "zod";

const AddSchema = z.object({
  email: z.string().email(),
  appPassword: z.string().min(8),
  label: z.string().optional(),
});

/** Returns "ok" | "bad_credentials" | "unreachable" */
async function testSmtpConnection(email: string, password: string): Promise<"ok" | "bad_credentials" | "unreachable"> {
  for (const { port, secure } of [{ port: 465, secure: true }, { port: 587, secure: false }]) {
    try {
      const t = nodemailer.createTransport({ host: "smtp.gmail.com", port, secure, family: 4, auth: { user: email, pass: password } });
      await t.verify();
      return "ok";
    } catch (err) {
      const msg = String(err instanceof Error ? err.message : err).toLowerCase();
      // Auth errors: invalid credentials
      if (msg.includes("invalid") || msg.includes("535") || msg.includes("username") || msg.includes("password") || msg.includes("authentication")) {
        return "bad_credentials";
      }
      // Network errors: timeout, unreachable — try next port
    }
  }
  // Both ports timed out / unreachable — save anyway, real test is at send time
  return "unreachable";
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const mailboxes = await db.mailbox.findMany({
    where: { userId: session.user.id },
    select: { id: true, email: true, provider: true, label: true, isDefault: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(mailboxes);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const body = await req.json();
  const parsed = AddSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { email, appPassword, label } = parsed.data;
  const cleanPassword = appPassword.replace(/\s/g, "");

  const result = await testSmtpConnection(email, cleanPassword);
  if (result === "bad_credentials") {
    return NextResponse.json(
      { error: "Gmail rejected the App Password — make sure you copied the 16-character App Password (not your regular Gmail password)." },
      { status: 400 }
    );
  }
  // result === "unreachable": SMTP port blocked on this network — save anyway

  const isFirst = (await db.mailbox.count({ where: { userId } })) === 0;

  const mailbox = await db.mailbox.upsert({
    where: { userId_email: { userId, email } },
    create: {
      userId,
      provider: "gmail-smtp",
      email,
      label: label || null,
      accessToken: cleanPassword,
      isDefault: isFirst,
    },
    update: {
      accessToken: cleanPassword,
      label: label || null,
    },
  });

  return NextResponse.json({
    id: mailbox.id,
    email: mailbox.email,
    provider: mailbox.provider,
    label: mailbox.label,
    isDefault: mailbox.isDefault,
    warning: result === "unreachable" ? "SMTP port unreachable on this network — account saved, but sending may fail until deployed to a server with open outbound port 587/465." : null,
  });
}
