import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import ApplicationActions from "./ApplicationActions";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const userId = session!.user!.id!;
  const { id } = await params;

  const [application, mailboxes] = await Promise.all([
    db.application.findFirst({
      where: { id, userId },
      include: { mailbox: true },
    }),
    db.mailbox.findMany({ where: { userId } }),
  ]);

  if (!application) notFound();

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
        <div>
          <h1 className="text-2xl font-bold text-white">{application.jobTitle}</h1>
          <p className="text-gray-400">{application.company}</p>
        </div>
        <span className={`text-sm font-semibold mt-1 ${statusColors[application.status] ?? "text-gray-400"}`}>
          {application.status.replace(/_/g, " ")}
        </span>
      </div>

      {/* Meta */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 grid grid-cols-2 gap-4 text-sm">
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
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">Cover letter draft</h2>
          {!application.coverLetter && application.status === "DRAFT" && (
            <div className="text-xs text-yellow-400 animate-pulse">Generating...</div>
          )}
        </div>

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
            }}
            mailboxes={mailboxes.map((m) => ({ id: m.id, email: m.email }))}
          />
        ) : (
          <div className="text-gray-500 text-sm">
            {application.status === "DRAFT"
              ? "Cover letter is being generated. Refresh in a moment."
              : "No cover letter."}
          </div>
        )}
      </div>

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
