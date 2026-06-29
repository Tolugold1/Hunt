import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const mailboxes = await db.mailbox.findMany({
    where: { userId: session.user.id },
    select: { id: true, email: true, provider: true, isDefault: true, createdAt: true },
  });

  return NextResponse.json(mailboxes);
}
