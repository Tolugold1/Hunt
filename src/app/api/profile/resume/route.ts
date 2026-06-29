import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseResumeFile } from "@/lib/resume-parser";
import { uploadResume } from "@/lib/storage";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const formData = await req.formData();
  const file = formData.get("resume") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const maxSize = 5 * 1024 * 1024; // 5 MB
  if (file.size > maxSize) {
    return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });
  }

  const allowedTypes = [
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const { text, structured } = await parseResumeFile(buffer, file.type);
  const resumeUrl = await uploadResume(userId, buffer, file.name, file.type);

  await db.profile.upsert({
    where: { userId },
    create: {
      userId,
      resumeUrl,
      resumeText: text,
      ...structured,
    },
    update: {
      resumeUrl,
      resumeText: text,
      ...structured,
    },
  });

  return NextResponse.json({ success: true, profile: structured });
}
