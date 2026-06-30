"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Toast from "@/components/Toast";

export default function ResumeUpload({ hasResume }: { hasResume: boolean }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  async function uploadFile(file: File) {
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setToast({ message: "File too large — max 5 MB", type: "error" });
      return;
    }

    const allowed = ["application/pdf", "text/plain", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type)) {
      setToast({ message: "Unsupported file type. Use PDF, DOC, DOCX, or TXT.", type: "error" });
      return;
    }

    setUploading(true);
    setToast(null);

    try {
      const form = new FormData();
      form.append("resume", file);
      const res = await fetch("/api/profile/resume", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setToast({ message: data.error ?? "Upload failed — check your API keys in .env", type: "error" });
        return;
      }

      setToast({ message: "Resume uploaded and parsed successfully!", type: "success" });
      router.refresh(); // re-runs the server component to show updated profile
    } catch {
      setToast({ message: "Network error — check the terminal for details", type: "error" });
    } finally {
      setUploading(false);
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => document.getElementById("resume-input")?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
          drag ? "border-blue-500 bg-blue-500/5" : "border-gray-700 hover:border-gray-500"
        }`}
      >
        <input
          id="resume-input"
          type="file"
          accept=".pdf,.txt,.doc,.docx"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
        />
        {uploading ? (
          <div className="space-y-3">
            <div className="text-gray-300 font-medium">Parsing with AI…</div>
            <div className="h-1.5 w-40 mx-auto bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full animate-pulse w-2/3" />
            </div>
            <div className="text-gray-500 text-xs">Extracting skills, titles, and experience</div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-3xl">📄</div>
            <div className="text-gray-300 font-medium text-sm">
              {hasResume ? "Drop a new resume to replace" : "Drop your resume here"}
            </div>
            <div className="text-gray-500 text-xs">PDF, DOC, DOCX, or TXT · Max 5 MB</div>
          </div>
        )}
      </div>
    </>
  );
}
