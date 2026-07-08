import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import ApplicationActions from "./ApplicationActions";
import CoverLetterPending from "./CoverLetterPending";
import ApplyFieldSheet, { type ApplyField } from "./ApplyFieldSheet";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const userId = session!.user!.id!;
  const { id } = await params;

  const [application, mailboxes, profile] = await Promise.all([
    db.application.findFirst({
      where: { id, userId },
      include: { mailbox: true },
    }),
    db.mailbox.findMany({ where: { userId } }),
    db.profile.findUnique({ where: { userId } }),
  ]);

  if (!application) notFound();

  // Prefilled fields for form-apply jobs — the common questions application forms ask.
  const p = profile as (typeof profile & {
    phone?: string | null;
    linkedInUrl?: string | null;
    githubUrl?: string | null;
    portfolioUrl?: string | null;
    salaryMin?: number | null;
    salaryCurrency?: string | null;
  }) | null;
  const applyFields: ApplyField[] = [];
  const pushField = (label: string, value: string | number | null | undefined, multiline = false) => {
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      applyFields.push({ label, value: String(value).trim(), multiline });
    }
  };
  pushField("Full name", p?.fullName);
  pushField("Email", session!.user!.email ?? null);
  pushField("Phone", p?.phone);
  pushField("Location", p?.location);
  pushField("Current title", p?.headline ?? p?.jobTitles?.[0]);
  pushField("Years of experience", p?.experienceYears != null ? `${p.experienceYears}` : null);
  pushField("LinkedIn", p?.linkedInUrl);
  pushField("GitHub", p?.githubUrl);
  pushField("Portfolio", p?.portfolioUrl);
  pushField("Key skills", p?.skills?.length ? p.skills.join(", ") : null);
  if (p?.salaryMin) pushField("Salary expectation", `${p.salaryCurrency ?? "USD"} ${p.salaryMin.toLocaleString()}+`);
  pushField("Cover letter / Why you're a fit", application.coverLetter, true);
  pushField("Professional summary", p?.summary, true);

  const isFormApply = application.applyType !== "EMAIL";

  const statusColors: Record<string, string> = {
    DRAFT: "text-yellow-400",
    APPROVED: "text-blue-400",
    SENT: "text-green-400",
    FAILED: "text-red-400",
    REJECTED_BY_USER: "text-gray-400",
    REPLIED: "text-purple-400",
    INTERVIEW: "text-pink-400",
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white break-words">{application.jobTitle}</h1>
          <p className="text-gray-400 break-words">{application.company}</p>
        </div>
        <span className={`text-sm font-semibold mt-1 shrink-0 ${statusColors[application.status] ?? "text-gray-400"}`}>
          {application.status.replace(/_/g, " ")}
        </span>
      </div>

      {/* Meta */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        {application.applyEmail && (
          <div>
            <div className="text-gray-500 text-xs mb-0.5">Apply email</div>
            <div className="text-gray-300">{application.applyEmail}</div>
          </div>
        )}
        {application.jobUrl && (
          <div>
            <div className="text-gray-500 text-xs mb-0.5">Job URL</div>
            <a href={application.jobUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline truncate block">
              {application.jobUrl}
            </a>
          </div>
        )}
        {application.mailbox && (
          <div>
            <div className="text-gray-500 text-xs mb-0.5">Sending from</div>
            <div className="text-gray-300">{application.mailbox.email}</div>
          </div>
        )}
        {application.matchScore != null && (
          <div>
            <div className="text-gray-500 text-xs mb-0.5">Match score</div>
            <div className="text-gray-300">{Math.round(application.matchScore * 100)}%</div>
          </div>
        )}
      </div>

      {/* Failure reason */}
      {application.status === "FAILED" && (application as typeof application & { failureReason?: string | null }).failureReason && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4">
          <div className="text-xs text-red-400 font-medium mb-1">Send failed — reason:</div>
          <div className="text-sm text-red-300 font-mono">
            {(application as typeof application & { failureReason?: string | null }).failureReason}
          </div>
        </div>
      )}

      {/* Cover letter draft */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-white">Cover letter draft</h2>

        {application.coverLetter ? (
          <ApplicationActions
            application={{
              id: application.id,
              status: application.status,
              coverLetter: application.coverLetter,
              emailSubject: application.emailSubject,
              applyEmail: application.applyEmail,
              applyType: application.applyType,
              jobUrl: application.jobUrl,
              mailboxId: application.mailboxId,
              tailoredResume: (application as typeof application & { tailoredResume?: string | null }).tailoredResume ?? null,
            }}
            mailboxes={mailboxes.map((m) => ({ id: m.id, email: m.email }))}
          />
        ) : application.status === "DRAFT" ? (
          <CoverLetterPending
            applicationId={application.id}
            createdAtMs={application.createdAt.getTime()}
            failed={!!(application as typeof application & { failureReason?: string | null }).failureReason}
          />
        ) : (
          <div className="text-gray-500 text-sm">No cover letter.</div>
        )}
      </div>

      {/* Quick-apply field sheet — only for jobs you apply to via a form/site */}
      {isFormApply && applyFields.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          {application.jobUrl && (
            <a
              href={application.jobUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Open the application form
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
          <ApplyFieldSheet fields={applyFields} />
          <p className="text-xs text-gray-600 pt-1 border-t border-gray-800">
            Tip: download your tailored résumé above and upload it as the CV/résumé on the form.
          </p>
        </div>
      )}

      {/* Job description */}
      {application.jobDescription && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-2">
          <h2 className="font-semibold text-white text-sm">Job description</h2>
          <pre className="text-gray-400 text-sm whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-auto">
            {application.jobDescription}
          </pre>
        </div>
      )}
    </div>
  );
}
