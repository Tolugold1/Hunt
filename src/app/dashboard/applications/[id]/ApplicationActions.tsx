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
    mailboxId: string | null;
    applyType: string;
  };
  mailboxes: { id: string; email: string }[];
};

export default function ApplicationActions({ application, mailboxes }: Props) {
  const router = useRouter();
  const [coverLetter, setCoverLetter] = useState(application.coverLetter);
  const [subject, setSubject] = useState(
    application.emailSubject ?? `Application for the role`
  );
  const [mailboxId, setMailboxId] = useState(
    application.mailboxId ?? mailboxes[0]?.id ?? ""
  );
  const [loading, setLoading] = useState<"approve" | "reject" | "save" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const isDraft = application.status === "DRAFT";
  const canAct = isDraft;

  async function patch(action: "approve" | "reject" | "update-draft", extra?: object) {
    setLoading(action === "update-draft" ? "save" : action);
    setFeedback(null);
    try {
      const res = await fetch(`/api/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, coverLetter, emailSubject: subject, mailboxId, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback(data.error ?? "Something went wrong.");
        return;
      }
      if (action === "approve") {
        setFeedback("Queued to send! Check back in a moment.");
      } else if (action === "reject") {
        setFeedback("Skipped.");
      } else {
        setFeedback("Saved.");
      }
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      {application.applyType === "EMAIL" && canAct && (
        <div className="space-y-2">
          <label className="text-xs text-gray-400">Email subject</label>
          <input
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
      )}

      {mailboxes.length > 0 && canAct && (
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

      <div className="space-y-2">
        <label className="text-xs text-gray-400">Cover letter</label>
        <textarea
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 min-h-[200px] resize-y font-mono"
          value={coverLetter}
          onChange={(e) => setCoverLetter(e.target.value)}
          readOnly={!canAct}
        />
      </div>

      {feedback && (
        <div className="text-sm text-blue-400">{feedback}</div>
      )}

      {canAct && (
        <div className="flex gap-3">
          <button
            onClick={() => patch("approve")}
            disabled={!!loading}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
          >
            {loading === "approve" ? "Queuing..." : "Approve & Send"}
          </button>
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
    </div>
  );
}
