"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  application: {
    id: string;
    status: string;
    coverLetter: string;
    emailSubject: string | null;
    applyEmail: string | null;
    applyType: string;
    jobUrl: string | null;
    mailboxId: string | null;
  };
  mailboxes: { id: string; email: string }[];
};

export default function ApplicationActions({ application, mailboxes }: Props) {
  const router = useRouter();
  const [coverLetter, setCoverLetter] = useState(application.coverLetter);
  const [subject, setSubject] = useState(
    application.emailSubject ?? "Application for the role"
  );
  const [mailboxId, setMailboxId] = useState(
    application.mailboxId ?? mailboxes[0]?.id ?? ""
  );
  const [loading, setLoading] = useState<"approve" | "reject" | "save" | null>(null);
  const [feedback, setFeedback] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const isDraft = application.status === "DRAFT";
  const isFailed = application.status === "FAILED";
  const isLinkOut = application.applyType === "LINK_OUT";
  const noMailbox = mailboxes.length === 0;

  async function patch(action: "approve" | "reject" | "update-draft" | "retry", extra?: object) {
    setLoading(action === "update-draft" ? "save" : action as "approve" | "reject" | "save");
    setFeedback(null);
    try {
      const res = await fetch(`/api/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, coverLetter, emailSubject: subject, mailboxId, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ msg: data.error ?? "Something went wrong.", type: "err" });
        return;
      }
      if (action === "approve" || action === "retry") {
        if (isLinkOut) {
          if (application.jobUrl) window.open(application.jobUrl, "_blank", "noopener");
          setFeedback({ msg: "Marked as applied! Job opened in a new tab.", type: "ok" });
        } else {
          setFeedback({ msg: "Re-queued to send! Check back in a moment.", type: "ok" });
        }
      } else if (action === "reject") {
        setFeedback({ msg: "Skipped.", type: "ok" });
      } else {
        setFeedback({ msg: "Saved.", type: "ok" });
      }
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Mailbox selector — only for email jobs */}
      {!isLinkOut && isDraft && (
        <>
          <div className="space-y-2">
            <label className="text-xs text-gray-400">Email subject</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          {noMailbox ? (
            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 text-xs text-yellow-400">
              No email account connected. Go to{" "}
              <a href="/dashboard/settings" className="underline">
                Settings → Mailboxes
              </a>{" "}
              to link a Gmail or SMTP account before sending.
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs text-gray-400">Send from</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                value={mailboxId}
                onChange={(e) => setMailboxId(e.target.value)}
              >
                {mailboxes.map((m) => (
                  <option key={m.id} value={m.id}>{m.email}</option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {/* Link-out notice */}
      {isLinkOut && isDraft && (
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-300">
          This job requires applying on the company website. Copy the cover letter below,
          then click <strong>Apply on site</strong> — we'll open the job page and mark this as applied.
        </div>
      )}

      {/* Cover letter textarea */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400">Cover letter</label>
        <textarea
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 min-h-[200px] resize-y font-mono"
          value={coverLetter}
          onChange={(e) => setCoverLetter(e.target.value)}
          readOnly={!isDraft && !isFailed}
        />
      </div>

      {feedback && (
        <div className={`text-sm ${feedback.type === "err" ? "text-red-400" : "text-green-400"}`}>
          {feedback.msg}
        </div>
      )}

      {isDraft && (
        <div className="flex gap-3">
          {isLinkOut ? (
            <button
              onClick={() => patch("approve")}
              disabled={!!loading}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading === "approve" ? "Opening..." : (
                <>
                  Apply on site
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => patch("approve")}
              disabled={!!loading || noMailbox}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
              title={noMailbox ? "Connect a mailbox first" : undefined}
            >
              {loading === "approve" ? "Queuing..." : "Approve & Send"}
            </button>
          )}
          <button
            onClick={() => patch("update-draft")}
            disabled={!!loading}
            className="px-4 py-2.5 border border-gray-700 hover:border-gray-500 text-gray-300 rounded-lg text-sm transition-colors"
          >
            {loading === "save" ? "Saving..." : "Save draft"}
          </button>
          <button
            onClick={() => patch("reject")}
            disabled={!!loading}
            className="px-4 py-2.5 text-gray-500 hover:text-red-400 text-sm transition-colors"
          >
            Skip
          </button>
        </div>
      )}

      {/* Failed — retry button */}
      {isFailed && !isLinkOut && (
        <div className="flex gap-3 items-center">
          <button
            onClick={() => patch("retry")}
            disabled={!!loading || noMailbox}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
          >
            {loading === "approve" ? "Re-queuing…" : "Retry send"}
          </button>
          {noMailbox && (
            <span className="text-xs text-yellow-400">
              No mailbox — <a href="/dashboard/settings" className="underline">connect one first</a>
            </span>
          )}
        </div>
      )}

      {/* Already approved LINK_OUT — show link to visit the job */}
      {!isDraft && isLinkOut && application.jobUrl && (
        <a
          href={application.jobUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          Open job site again →
        </a>
      )}
    </div>
  );
}
