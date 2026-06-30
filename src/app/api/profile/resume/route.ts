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

  let file: File | null = null;
  try {
    const formData = await req.formData();
    file = formData.get("resume") as File | null;
  } catch {
    return NextResponse.json({ error: "Could not read form data" }, { status: 400 });
  }

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });

  const allowedTypes = [
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Step 1: parse text + LLM extraction
  let text: string;
  let structured: Awaited<ReturnType<typeof parseResumeFile>>["structured"];
  try {
    const parsed = await parseResumeFile(buffer, file.type);
    text = parsed.text;
    structured = parsed.structured;
  } catch (err) {
    console.error("[profile/resume] parse error:", err);
    const msg = err instanceof Error ? err.message : "Failed to parse resume";
    return NextResponse.json({ error: `Parse failed: ${msg}` }, { status: 500 });
  }

  // Step 2: upload to Cloudinary
  let resumeUrl: string;
  try {
    resumeUrl = await uploadResume(userId, buffer, file.name, file.type);
  } catch (err) {
    console.error("[profile/resume] cloudinary error:", err);
    const msg = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: `Cloudinary upload failed: ${msg}` }, { status: 500 });
  }

  // Step 3: save to DB
  try {
    await db.profile.upsert({
      where: { userId },
      create: { userId, resumeUrl, resumeText: text, ...structured },
      update: { resumeUrl, resumeText: text, ...structured },
    });
  } catch (err) {
    console.error("[profile/resume] db error:", err);
    return NextResponse.json({ error: "Failed to save profile to database" }, { status: 500 });
  }

  return NextResponse.json({ success: true, profile: structured });
}
