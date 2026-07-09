import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { renderResumePdf } from "@/lib/resume-pdf";

export const maxDuration = 30;

// Download the résumé used for this application as a PDF: the job-tailored version
// if we have one, otherwise a PDF rendered from the stored résumé text. We always
// render to PDF (never serve the raw upload) so the download is reliably a .pdf.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { id } = await params;
  const [application, profile] = await Promise.all([
    db.application.findFirst({ where: { id, userId } }),
    db.profile.findUnique({ where: { userId } }),
  ]);
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tailored = (application as typeof application & { tailoredResume?: string | null }).tailoredResume;
  const resumeText = tailored || profile?.resumeText;
  if (!resumeText) return NextResponse.json({ error: "No résumé on file — upload one first." }, { status: 404 });

  const fullName = profile?.fullName ?? "resume";
  const safeName = fullName.replace(/\s+/g, "-");
  const safeCompany = application.company.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 40) || "job";
  const filename = `${safeName}-${safeCompany}-cv.pdf`;

  try {
    const pdf = await renderResumePdf(resumeText, fullName);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[resume download] render failed:", err);
    return NextResponse.json({ error: "Failed to generate résumé PDF" }, { status: 500 });
  }
}
