import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { renderResumePdf } from "@/lib/resume-pdf";
import { getResumeBuffer, getResumeDownloadUrl } from "@/lib/storage";

export const maxDuration = 30;

// Download the résumé used for this application: the job-tailored version if we
// have one, otherwise the original uploaded résumé.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { id } = await params;
  const application = await db.application.findFirst({ where: { id, userId } });
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tailored = (application as typeof application & { tailoredResume?: string | null }).tailoredResume;

  if (tailored) {
    const profile = await db.profile.findUnique({ where: { userId }, select: { fullName: true } });
    const pdf = await renderResumePdf(tailored, profile?.fullName ?? undefined);
    const safeName = (profile?.fullName ?? "resume").replace(/\s+/g, "-");
    const safeCompany = application.company.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 40) || "job";
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}-${safeCompany}-cv.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // No tailored version — fall back to the original upload.
  const profile = await db.profile.findUnique({ where: { userId }, select: { resumeUrl: true, fullName: true } });
  if (!profile?.resumeUrl) return NextResponse.json({ error: "No résumé on file" }, { status: 404 });

  try {
    const signed = await getResumeDownloadUrl(profile.resumeUrl);
    return NextResponse.redirect(signed);
  } catch {
    // If signing fails, stream the bytes directly.
    const buf = await getResumeBuffer(profile.resumeUrl);
    const safeName = (profile.fullName ?? "resume").replace(/\s+/g, "-");
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}-cv.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }
}
