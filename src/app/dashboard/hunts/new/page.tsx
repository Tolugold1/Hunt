"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Toast from "@/components/Toast";

type HuntType = "JOB" | "SOCIAL";

const JOB_SOURCES = [
  { id: "email-apply", label: "Email-Apply boards (CryptoJobsList, Web3 Jobs)" },
  { id: "greenhouse", label: "Greenhouse (ATS)" },
  { id: "lever", label: "Lever (ATS)" },
  { id: "workable", label: "Workable (ATS)" },
];

const SOCIAL_PLATFORMS = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "twitter", label: "X / Twitter" },
  { id: "bluesky", label: "Bluesky" },
];


const CURRENCIES = [
  { code: "USD", symbol: "$", label: "USD — US Dollar" },
  { code: "EUR", symbol: "€", label: "EUR — Euro" },
  { code: "GBP", symbol: "£", label: "GBP — British Pound" },
  { code: "CAD", symbol: "CA$", label: "CAD — Canadian Dollar" },
  { code: "AUD", symbol: "A$", label: "AUD — Australian Dollar" },
  { code: "NGN", symbol: "₦", label: "NGN — Nigerian Naira" },
  { code: "KES", symbol: "KSh", label: "KES — Kenyan Shilling" },
  { code: "ZAR", symbol: "R", label: "ZAR — South African Rand" },
  { code: "INR", symbol: "₹", label: "INR — Indian Rupee" },
  { code: "SGD", symbol: "S$", label: "SGD — Singapore Dollar" },
  { code: "AED", symbol: "د.إ", label: "AED — UAE Dirham" },
];

export default function NewHuntPage() {
  const router = useRouter();
  const [type, setType] = useState<HuntType>("JOB");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const [runNow, setRunNow] = useState(false);

  const dismissToast = useCallback(() => setToast(null), []);
  function showError(msg: string) { setToast({ message: msg, type: "error" }); }
  function showSuccess(msg: string) { setToast({ message: msg, type: "success" }); }

  // Shared
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // cronExpression intentionally unused until scheduling is released
  const [maxActionsPerRun, setMaxActionsPerRun] = useState(10);
  const [approvalRequired, setApprovalRequired] = useState(true);

  // JOB fields
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [location, setLocation] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryCurrency, setSalaryCurrency] = useState("USD");
  const [sources, setSources] = useState<string[]>(["email-apply"]);
  const [suggesting, setSuggesting] = useState(false);

  // SOCIAL fields
  const [topics, setTopics] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["linkedin"]);
  const [tone, setTone] = useState("professional");

  function toggleSet(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  function addKeyword(kw: string) {
    const trimmed = kw.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords((prev) => [...prev, trimmed]);
    }
  }

  function removeKeyword(kw: string) {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  }

  function handleKeywordInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword(keywordInput);
      setKeywordInput("");
    }
  }

  async function suggestKeywords() {
    if (!name.trim()) {
      showError("Enter a hunt name first — that's what keywords are generated from.");
      return;
    }
    setSuggesting(true);
    try {
      const res = await fetch("/api/hunts/suggest-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle: name }),
      });
      const data = await res.json();
      if (data.keywords?.length) {
        const fresh = (data.keywords as string[]).filter((k) => !keywords.includes(k));
        setKeywords((prev) => [...prev, ...fresh]);
      }
    } catch {
      showError("Could not generate keywords. Check your LLM API key in .env.");
    } finally {
      setSuggesting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) { showError("Hunt name is required"); return; }
    if (type === "JOB" && keywords.length === 0) { showError("Add at least one keyword"); return; }
    if (type === "JOB" && sources.length === 0) { showError("Select at least one source"); return; }
    if (type === "SOCIAL" && !topics.trim()) { showError("Enter at least one topic"); return; }
    if (type === "SOCIAL" && platforms.length === 0) { showError("Select at least one platform"); return; }

    setLoading(true);

    const body = {
      name: name.trim(),
      description: description.trim() || undefined,
      type,
      maxActionsPerRun,
      approvalRequired,
      keywords: type === "JOB" ? keywords : [],
      location: type === "JOB" ? location.trim() || undefined : undefined,
      remoteOnly: type === "JOB" ? remoteOnly : false,
      salaryMin: type === "JOB" && salaryMin ? parseInt(salaryMin) : undefined,
      salaryCurrency: type === "JOB" ? salaryCurrency : undefined,
      sources: type === "JOB" ? sources : [],
      topics: type === "SOCIAL" ? topics.split(",").map((t) => t.trim()).filter(Boolean) : [],
      platforms: type === "SOCIAL" ? platforms : [],
      tone: type === "SOCIAL" ? tone : undefined,
    };

    const res = await fetch("/api/hunts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      const msg = typeof data.error === "string"
        ? data.error
        : data.error?.formErrors?.[0] ?? "Failed to create hunt";
      showError(msg);
      return;
    }

    const hunt = await res.json();

    if (runNow) {
      const runRes = await fetch(`/api/hunts/${hunt.id}/run`, { method: "POST" });
      if (!runRes.ok) {
        const runData = await runRes.json();
        router.push(`/dashboard/hunts?toast=${encodeURIComponent("Hunt created — but failed to queue: " + (runData.error ?? "unknown error"))}&type=error`);
        return;
      }
      router.push(`/dashboard/hunts?toast=${encodeURIComponent("Hunt created and queued! Start `npm run workers` to process it.")}&type=success`);
      return;
    }

    router.push(`/dashboard/hunts?toast=${encodeURIComponent("Hunt created successfully!")}&type=success`);
  }

  const currencySymbol = CURRENCIES.find((c) => c.code === salaryCurrency)?.symbol ?? "$";

  return (
    <div className="max-w-2xl space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}
      <div>
        <Link href="/dashboard/hunts" className="text-gray-500 hover:text-gray-300 text-sm">
          ← Back to Hunts
        </Link>
        <h1 className="text-2xl font-bold text-white mt-3">New Hunt</h1>
        <p className="text-gray-400 text-sm mt-1">
          A hunt is a saved automation — it finds matches, drafts content, and queues it for your approval.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Hunt type */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Hunt type</h2>
          <div className="grid grid-cols-2 gap-3">
            {(["JOB", "SOCIAL"] as HuntType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  type === t
                    ? "border-blue-500 bg-blue-500/10 text-white"
                    : "border-gray-700 text-gray-400 hover:border-gray-600"
                }`}
              >
                <div className="font-semibold text-sm">
                  {t === "JOB" ? "Job Hunt" : "Social Presence"}
                </div>
                <div className="text-xs mt-1 text-gray-500">
                  {t === "JOB"
                    ? "Find jobs, draft cover letters, send applications"
                    : "Find articles, generate posts, publish to your profiles"}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Basics */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Basics</h2>
          <Field label="Hunt name" hint={type === "JOB" ? "Use the job title — keywords will be generated from it" : undefined}>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === "JOB" ? "e.g. Senior Backend Developer" : "e.g. Web3 Thought Leadership"}
              className="input"
            />
          </Field>
          <Field label="Description (optional)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What's this hunt for?"
              className="input resize-none"
            />
          </Field>
        </div>

        {/* JOB-specific */}
        {type === "JOB" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Job criteria</h2>

            {/* Keywords */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-300">Search keywords</label>
                <button
                  type="button"
                  onClick={suggestKeywords}
                  disabled={suggesting}
                  className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
                >
                  {suggesting ? (
                    <>
                      <SpinIcon />
                      Generating…
                    </>
                  ) : (
                    <>
                      <SparkleIcon />
                      Auto-generate from hunt name
                    </>
                  )}
                </button>
              </div>

              {/* Tag pills */}
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((kw) => (
                    <span
                      key={kw}
                      className="inline-flex items-center gap-1 bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs px-2.5 py-1 rounded-full"
                    >
                      {kw}
                      <button
                        type="button"
                        onClick={() => removeKeyword(kw)}
                        className="hover:text-white transition-colors ml-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleKeywordInputKey}
                onBlur={() => { if (keywordInput.trim()) { addKeyword(keywordInput); setKeywordInput(""); } }}
                placeholder="Type a keyword and press Enter or comma…"
                className="input"
              />
              <p className="text-xs text-gray-600">Press Enter or comma to add each keyword</p>
            </div>

            {/* Location */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Location">
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Lagos, London, NYC…"
                  className="input"
                  disabled={remoteOnly}
                />
              </Field>
              <Field label="Min. compensation (optional)">
                <div className="flex gap-2">
                  <select
                    value={salaryCurrency}
                    onChange={(e) => setSalaryCurrency(e.target.value)}
                    className="input w-24 shrink-0"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm select-none">
                      {currencySymbol}
                    </span>
                    <input
                      type="number"
                      value={salaryMin}
                      onChange={(e) => setSalaryMin(e.target.value)}
                      placeholder="80,000"
                      className="input pl-7"
                      min={0}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-1">Annual, in {salaryCurrency}</p>
              </Field>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={remoteOnly}
                onChange={(e) => setRemoteOnly(e.target.checked)}
                className="accent-blue-500"
              />
              Remote only
            </label>

            {/* Sources */}
            <Field label="Job sources">
              <div className="space-y-2 mt-1">
                {JOB_SOURCES.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sources.includes(s.id)}
                      onChange={() => toggleSet(sources, setSources, s.id)}
                      className="accent-blue-500"
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            </Field>
          </div>
        )}

        {/* SOCIAL-specific */}
        {type === "SOCIAL" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Social criteria</h2>
            <Field label="Topics (comma-separated)" hint="What you want to post about">
              <input
                type="text"
                value={topics}
                onChange={(e) => setTopics(e.target.value)}
                placeholder="React, TypeScript, Web3, Product Management"
                className="input"
              />
            </Field>
            <Field label="Platforms">
              <div className="space-y-2 mt-1">
                {SOCIAL_PLATFORMS.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={platforms.includes(p.id)}
                      onChange={() => toggleSet(platforms, setPlatforms, p.id)}
                      className="accent-blue-500"
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Tone">
              <select value={tone} onChange={(e) => setTone(e.target.value)} className="input">
                <option value="professional">Professional</option>
                <option value="casual">Casual / Conversational</option>
                <option value="thought-leader">Thought leader</option>
                <option value="technical">Technical deep-dive</option>
              </select>
            </Field>
          </div>
        )}

        {/* Schedule — Coming Soon */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4 relative overflow-hidden">
          {/* Coming soon overlay */}
          <div className="absolute inset-0 bg-gray-950/60 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center gap-2 rounded-xl">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400 border border-gray-700 rounded-full px-3 py-1 bg-gray-900">
              Coming Soon
            </span>
            <p className="text-xs text-gray-500 text-center max-w-xs px-4">
              Automatic scheduling will be enabled when we move to production. For now, trigger hunts manually with "Run now".
            </p>
          </div>

          {/* Greyed-out preview (behind overlay) */}
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-widest">Schedule</h2>
          <div className="flex flex-wrap gap-2">
            {["Twice a day", "Once a day (8am)", "Every 6 hours", "Weekdays only", "Manual only"].map((label) => (
              <span key={label} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-800 text-gray-700">
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Limits & approval */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Limits & approval</h2>
          <Field
            label={`Max per run: ${maxActionsPerRun}`}
            hint="Applications drafted (or posts generated) per manual run"
          >
            <input
              type="range"
              min={1}
              max={50}
              value={maxActionsPerRun}
              onChange={(e) => setMaxActionsPerRun(parseInt(e.target.value))}
              className="w-full accent-blue-500"
            />
          </Field>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={approvalRequired}
              onChange={(e) => setApprovalRequired(e.target.checked)}
              className="accent-blue-500 mt-0.5"
            />
            <div>
              <div className="text-sm text-gray-300 font-medium">Require my approval before sending</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Drafts land in Applications for you to review. Uncheck for fully automated sending.
              </div>
            </div>
          </label>
        </div>

        {/* Run immediately */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={runNow}
              onChange={(e) => setRunNow(e.target.checked)}
              className="accent-blue-500 mt-0.5"
            />
            <div>
              <div className="text-sm text-white font-medium">Run immediately after creating</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Queues the hunt right away. Requires Redis to be running and{" "}
                <code className="text-gray-400 bg-gray-800 px-1 rounded">npm run workers</code> to be active in a separate terminal.
              </div>
            </div>
          </label>
        </div>

        <div className="flex gap-3 pb-8">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
          >
            {loading ? "Creating…" : "Create Hunt"}
          </button>
          <Link
            href="/dashboard/hunts"
            className="px-6 py-2.5 border border-gray-700 hover:border-gray-500 text-gray-300 font-semibold rounded-lg text-sm transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>

      <style jsx global>{`
        .input {
          width: 100%;
          background: #1f2937;
          border: 1px solid #374151;
          border-radius: 8px;
          padding: 8px 12px;
          color: #f9fafb;
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s;
        }
        .input:focus { border-color: #3b82f6; }
        .input::placeholder { color: #6b7280; }
        .input:disabled { opacity: 0.4; cursor: not-allowed; }
        select.input option { background: #1f2937; }
      `}</style>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm text-gray-300">{label}</label>
      {hint && <p className="text-xs text-gray-500 -mt-1">{hint}</p>}
      {children}
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
      <path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75z" />
    </svg>
  );
}

function SpinIcon() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
