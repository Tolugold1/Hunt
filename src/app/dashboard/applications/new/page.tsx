"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewApplicationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    jobTitle: "",
    company: "",
    jobUrl: "",
    jobDescription: "",
    applyEmail: "",
    source: "manual",
    applyType: "EMAIL" as "EMAIL" | "FORM" | "LINK_OUT",
  });

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.formErrors?.join(", ") ?? "Failed to create application.");
        return;
      }
      router.push(`/dashboard/applications/${data.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Add a job</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Paste job details and Hunt will generate a tailored cover letter draft.
        </p>
      </div>

      <form onSubmit={submit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Job title" required>
            <input
              className="input"
              placeholder="e.g. Backend Engineer"
              value={form.jobTitle}
              onChange={(e) => set("jobTitle", e.target.value)}
              required
            />
          </Field>
          <Field label="Company" required>
            <input
              className="input"
              placeholder="e.g. Acme Corp"
              value={form.company}
              onChange={(e) => set("company", e.target.value)}
              required
            />
          </Field>
        </div>

        <Field label="Job URL">
          <input
            className="input"
            placeholder="https://..."
            value={form.jobUrl}
            onChange={(e) => set("jobUrl", e.target.value)}
            type="url"
          />
        </Field>

        <Field label="Apply type" required>
          <select
            className="input"
            value={form.applyType}
            onChange={(e) => set("applyType", e.target.value as typeof form.applyType)}
          >
            <option value="EMAIL">Email CV (Hunt sends the email)</option>
            <option value="FORM">Form apply (Hunt pre-fills, I submit)</option>
            <option value="LINK_OUT">Just draft for me (I apply myself)</option>
          </select>
        </Field>

        {form.applyType === "EMAIL" && (
          <Field label="Apply email" required>
            <input
              className="input"
              type="email"
              placeholder="jobs@company.com"
              value={form.applyEmail}
              onChange={(e) => set("applyEmail", e.target.value)}
            />
          </Field>
        )}

        <Field label="Job description" required>
          <textarea
            className="input min-h-[160px] resize-y"
            placeholder="Paste the full job description here..."
            value={form.jobDescription}
            onChange={(e) => set("jobDescription", e.target.value)}
            required
          />
        </Field>

        {error && (
          <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
        >
          {loading ? "Generating draft..." : "Generate cover letter draft →"}
        </button>
      </form>

      <style jsx global>{`
        .input {
          width: 100%;
          background: #111827;
          border: 1px solid #374151;
          border-radius: 8px;
          padding: 8px 12px;
          color: #f9fafb;
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s;
        }
        .input:focus {
          border-color: #3b82f6;
        }
        .input::placeholder {
          color: #6b7280;
        }
        select.input option {
          background: #1f2937;
        }
      `}</style>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-300">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
