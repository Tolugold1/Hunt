"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mailbox = { id: string; email: string; provider: string; label: string | null; isDefault: boolean };

export default function MailboxManager({ mailboxes: initial }: { mailboxes: Mailbox[] }) {
  const router = useRouter();
  const [mailboxes, setMailboxes] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  async function addMailbox() {
    if (!email || !appPassword) { setError("Email and App Password are required."); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/mailboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, appPassword, label }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to add mailbox."); return; }
      setMailboxes((prev) => [...prev, data]);
      setEmail(""); setAppPassword(""); setLabel(""); setShowForm(false);
      if (data.warning) setError(`Saved, but note: ${data.warning}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function removeMailbox(id: string) {
    setDeleting(id);
    try {
      await fetch(`/api/mailboxes/${id}`, { method: "DELETE" });
      setMailboxes((prev) => prev.filter((m) => m.id !== id));
      router.refresh();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-white">Email accounts</h2>
          <p className="text-gray-400 text-sm mt-0.5">
            Connect a Gmail account to auto-send applications. Uses Gmail App Passwords — no OAuth needed.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex-shrink-0 text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors"
          >
            + Add account
          </button>
        )}
      </div>

      {/* Existing mailboxes */}
      {mailboxes.length > 0 && (
        <div className="space-y-2">
          {mailboxes.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 bg-gray-800 rounded-lg px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm text-white font-medium truncate">{m.email}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {m.label ? `${m.label} · ` : ""}{m.provider === "gmail-smtp" ? "Gmail App Password" : m.provider}
                  {m.isDefault && <span className="ml-2 text-blue-400">default</span>}
                </div>
              </div>
              <button
                onClick={() => removeMailbox(m.id)}
                disabled={deleting === m.id}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50 shrink-0"
              >
                {deleting === m.id ? "Removing…" : "Remove"}
              </button>
            </div>
          ))}
        </div>
      )}

      {mailboxes.length === 0 && !showForm && (
        <div className="text-sm text-gray-500">No email accounts connected yet.</div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="space-y-3 border-t border-gray-800 pt-5">
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Gmail address</label>
            <input
              type="email"
              placeholder="you@gmail.com"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">App Password <span className="text-gray-600">(16-char, no spaces)</span></label>
            <input
              type="password"
              placeholder="xxxx xxxx xxxx xxxx"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Label <span className="text-gray-600">(optional)</span></label>
            <input
              type="text"
              placeholder="e.g. Work Gmail"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-300 space-y-1">
            <p className="font-medium">How to create a Gmail App Password:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-blue-400">
              <li>Go to myaccount.google.com → Security</li>
              <li>Enable 2-Step Verification if not already on</li>
              <li>Search for "App passwords" at the top</li>
              <li>Choose app: Mail, device: Windows — click Generate</li>
              <li>Copy the 16-character password and paste it above</li>
            </ol>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={addMailbox}
              disabled={saving}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
            >
              {saving ? "Connecting…" : "Connect account"}
            </button>
            <button
              onClick={() => { setShowForm(false); setError(""); }}
              className="px-4 py-2 border border-gray-700 text-gray-400 rounded-lg text-sm hover:border-gray-500 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
