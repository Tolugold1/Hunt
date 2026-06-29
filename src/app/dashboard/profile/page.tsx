"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string; profile?: Record<string, unknown> } | null>(null);

  async function uploadFile(file: File) {
    setUploading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("resume", file);
      const res = await fetch("/api/profile/resume", { method: "POST", body: form });
      const data = await res.json();
      setResult(data);
      if (data.success) router.refresh();
    } catch {
      setResult({ error: "Upload failed. Please try again." });
    } finally {
      setUploading(false);
    }
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Profile & Resume</h1>
        <p className="text-gray-400 mt-1">Your resume powers every cover letter Hunt generates.</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold text-white">Resume</h2>

        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
            drag ? "border-blue-500 bg-blue-500/5" : "border-gray-700 hover:border-gray-500"
          }`}
          onClick={() => document.getElementById("resume-input")?.click()}
        >
          <input
            id="resume-input"
            type="file"
            accept=".pdf,.txt,.doc,.docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFile(file);
            }}
          />
          {uploading ? (
            <div className="space-y-2">
              <div className="text-gray-400">Uploading & parsing with AI...</div>
              <div className="h-1 w-32 mx-auto bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full animate-pulse w-2/3" />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-4xl">📄</div>
              <div className="text-gray-300 font-medium">Drop your resume here</div>
              <div className="text-gray-500 text-sm">PDF, DOC, DOCX, or TXT · Max 5 MB</div>
            </div>
          )}
        </div>

        {result && (
          <div className={`rounded-lg p-4 text-sm ${result.success ? "bg-green-500/10 border border-green-500/30 text-green-400" : "bg-red-500/10 border border-red-500/30 text-red-400"}`}>
            {result.success ? (
              <div className="space-y-2">
                <div className="font-semibold">Resume uploaded and parsed successfully.</div>
                {result.profile && (() => {
                  const p = result.profile as Record<string, unknown>;
                  return (
                    <div className="text-green-300/70 space-y-0.5">
                      {p.fullName ? <div>Name: {String(p.fullName)}</div> : null}
                      {p.headline ? <div>Headline: {String(p.headline)}</div> : null}
                      {Array.isArray(p.skills) ? (
                        <div>Skills: {(p.skills as string[]).slice(0, 6).join(", ")}</div>
                      ) : null}
                    </div>
                  );
                })()}
              </div>
            ) : (
              result.error
            )}
          </div>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="font-semibold text-white mb-4">Connected mailbox</h2>
        <p className="text-gray-400 text-sm">
          Your Gmail account is connected via the Google sign-in. Applications will be sent from that address.
          To change it, sign in with a different Google account.
        </p>
      </div>
    </div>
  );
}
