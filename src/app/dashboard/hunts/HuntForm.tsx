"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Toast from "@/components/Toast";

type HuntType = "JOB" | "SOCIAL";

const JOB_SOURCES = [
  { id: "email-apply", label: "Remote boards — Remotive, RemoteOK, Arbeitnow, Jobicy" },
  { id: "myjobmag", label: "MyJobMag (Nigeria & Africa)" },
  { id: "fuzu", label: "Fuzu (Africa)" },
  { id: "greenhouse", label: "Greenhouse (ATS — coming soon)" },
  { id: "lever", label: "Lever (ATS — coming soon)" },
  { id: "workable", label: "Workable (ATS — coming soon)" },
];

const SOCIAL_PLATFORMS = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "twitter", label: "X / Twitter" },
  { id: "bluesky", label: "Bluesky" },
];

const CURRENCIES = [
  { code: "USD", symbol: "$" }, { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" }, { code: "CAD", symbol: "CA$" },
  { code: "AUD", symbol: "A$" }, { code: "NGN", symbol: "₦" },
  { code: "KES", symbol: "KSh" }, { code: "ZAR", symbol: "R" },
  { code: "INR", symbol: "₹" }, { code: "SGD", symbol: "S$" },
  { code: "AED", symbol: "د.إ" },
];

export interface HuntInitialValues {
  name?: string;
  description?: string;
  type?: HuntType;
  keywords?: string[];
  location?: string;
  remoteOnly?: boolean;
  salaryMin?: number | null;
  salaryCurrency?: string;
  sources?: string[];
  customSources?: string[];
  topics?: string[];
  platforms?: string[];
  tone?: string;
  cronExpression?: string | null;
  maxActionsPerRun?: number;
  approvalRequired?: boolean;
}

interface Props {
  mode: "create" | "edit";
  huntId?: string;
  initial?: HuntInitialValues;
}

export default function HuntForm({ mode, huntId, initial = {} }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const [loading, setLoading] = useState(false);
  const [runNow, setRunNow] = useState(false);

  const dismissToast = useCallback(() => setToast(null), []);
  function showError(msg: string) { setToast({ message: msg, type: "error" }); }

  // ── State ─────────────────────────────────────────────────────────────────
  const [type, setType] = useState<HuntType>(initial.type ?? "JOB");
  const [name, setName] = useState(initial.name ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [maxActionsPerRun, setMaxActionsPerRun] = useState(initial.maxActionsPerRun ?? 10);
  const [approvalRequired, setApprovalRequired] = useState(initial.approvalRequired ?? true);
  const [cronExpression, setCronExpression] = useState(initial.cronExpression ?? "");

  // JOB
  const [keywords, setKeywords] = useState<string[]>(initial.keywords ?? []);
  const [keywordInput, setKeywordInput] = useState("");
  const [location, setLocation] = useState(initial.location ?? "");
  const [remoteOnly, setRemoteOnly] = useState(initial.remoteOnly ?? false);
  const [salaryMin, setSalaryMin] = useState(initial.salaryMin ? String(initial.salaryMin) : "");
  const [salaryCurrency, setSalaryCurrency] = useState(initial.salaryCurrency ?? "USD");
  const [sources, setSources] = useState<string[]>(initial.sources ?? ["email-apply"]);
  const [customSources, setCustomSources] = useState<string[]>(initial.customSources ?? []);
  const [customSourceInput, setCustomSourceInput] = useState("");
  const [suggesting, setSuggesting] = useState(false);

  // SOCIAL
  const [topics, setTopics] = useState((initial.topics ?? []).join(", "));
  const [platforms, setPlatforms] = useState<string[]>(initial.platforms ?? ["linkedin"]);
  const [tone, setTone] = useState(initial.tone ?? "professional");

  // ── Helpers ───────────────────────────────────────────────────────────────
  function toggleArr(arr: string[], set: (v: string[]) => void, val: string) {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  function addKeyword(kw: string) {
    const t = kw.trim();
    if (t && !keywords.includes(t)) setKeywords((p) => [...p, t]);
  }

  function addCustomSource(url: string) {
    const t = url.trim();
    if (!t) return;
    if (!/^https?:\/\//i.test(t)) { showError("Please enter a full URL starting with https://"); return; }
    if (!customSources.includes(t)) setCustomSources((p) => [...p, t]);
  }

  async function suggestKeywords() {
    if (!name.trim()) { showError("Enter a hunt name first."); return; }
    setSuggesting(true);
    try {
      const res = await fetch("/api/hunts/suggest-keywords", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle: name }),
      });
      const data = await res.json();
      if (data.keywords?.length) {
        const fresh = (data.keywords as string[]).filter((k) => !keywords.includes(k));
        setKeywords((p) => [...p, ...fresh]);
      }
    } catch {
      showError("Could not generate keywords — check your LLM API key.");
    } finally {
      setSuggesting(false);
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { showError("Hunt name is required"); return; }
    if (type === "JOB" && keywords.length === 0) { showError("Add at least one keyword"); return; }
    if (type === "JOB" && sources.length === 0 && customSources.length === 0) {
      showError("Select at least one job source or add a custom URL"); return;
    }
    if (type === "SOCIAL" && !topics.trim()) { showError("Enter at least one topic"); return; }
    if (type === "SOCIAL" && platforms.length === 0) { showError("Select at least one platform"); return; }

    setLoading(true);

    const body = {
      name: name.trim(),
      description: description.trim() || undefined,
      type,
      maxActionsPerRun,
      approvalRequired,
      cronExpression: cronExpression || null,
      keywords: type === "JOB" ? keywords : [],
      location: type === "JOB" ? location.trim() || undefined : undefined,
      remoteOnly: type === "JOB" ? remoteOnly : false,
      salaryMin: type === "JOB" && salaryMin ? parseInt(salaryMin) : undefined,
      salaryCurrency: type === "JOB" ? salaryCurrency : undefined,
      sources: type === "JOB" ? sources : [],
      customSources: type === "JOB" ? customSources : [],
      topics: type === "SOCIAL" ? topics.split(",").map((t) => t.trim()).filter(Boolean) : [],
      platforms: type === "SOCIAL" ? platforms : [],
      tone: type === "SOCIAL" ? tone : undefined,
    };

    const res = await fetch(
      mode === "create" ? "/api/hunts" : `/api/hunts/${huntId}`,
      {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      showError(typeof data.error === "string" ? data.error : "Failed to save hunt");
      return;
    }

    const hunt = await res.json();

    if (mode === "create" && runNow) {
      await fetch(`/api/hunts/${hunt.id}/run`, { method: "POST" });
      router.push(`/dashboard/hunts?toast=${encodeURIComponent("Hunt created and running!")}&type=success`);
      return;
    }

    const msg = mode === "create" ? "Hunt created successfully!" : "Hunt updated!";
    router.push(`/dashboard/hunts?toast=${encodeURIComponent(msg)}&type=success`);
  }

  const currencySymbol = CURRENCIES.find((c) => c.code === salaryCurrency)?.symbol ?? "$";

  return (
    <div className="max-w-2xl space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}

      <div>
        <Link href="/dashboard/hunts" className="text-gray-500 hover:text-gray-300 text-sm">
          ← Back to Hunts
        </Link>
        <h1 className="text-2xl font-bold text-white mt-3">
          {mode === "create" ? "New Hunt" : "Edit Hunt"}
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          {mode === "create"
            ? "A hunt finds matches, drafts content, and queues it for your approval."
            : "Update your hunt settings. Changes apply on the next run."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type — only editable on create */}
        {mode === "create" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Hunt type</h2>
            <div className="grid grid-cols-2 gap-3">
              {(["JOB", "SOCIAL"] as HuntType[]).map((t) => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`rounded-lg border p-4 text-left transition-colors ${type === t ? "border-blue-500 bg-blue-500/10 text-white" : "border-gray-700 text-gray-400 hover:border-gray-600"}`}>
                  <div className="font-semibold text-sm">{t === "JOB" ? "Job Hunt" : "Social Presence"}</div>
                  <div className="text-xs mt-1 text-gray-500">
                    {t === "JOB" ? "Find jobs, draft cover letters, send applications" : "Find articles, generate posts, publish to your profiles"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Basics */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Basics</h2>
          <Field label="Hunt name">
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
              placeholder={type === "JOB" ? "e.g. Senior Backend Developer" : "e.g. Web3 Thought Leadership"}
              className="input" />
          </Field>
          <Field label="Description (optional)">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              rows={2} placeholder="What's this hunt for?" className="input resize-none" />
          </Field>
        </div>

        {/* JOB criteria */}
        {type === "JOB" && (
          <>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Job criteria</h2>

              {/* Keywords */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-300">Search keywords</label>
                  <button type="button" onClick={suggestKeywords} disabled={suggesting}
                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50">
                    {suggesting ? <><SpinIcon />Generating…</> : <><SparkleIcon />Auto-generate from name</>}
                  </button>
                </div>
                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {keywords.map((kw) => (
                      <span key={kw} className="inline-flex items-center gap-1 bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs px-2.5 py-1 rounded-full">
                        {kw}
                        <button type="button" onClick={() => setKeywords((p) => p.filter((k) => k !== kw))} className="hover:text-white ml-0.5">×</button>
                      </span>
                    ))}
                  </div>
                )}
                <input type="text" value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addKeyword(keywordInput); setKeywordInput(""); } }}
                  onBlur={() => { if (keywordInput.trim()) { addKeyword(keywordInput); setKeywordInput(""); } }}
                  placeholder="Type a keyword and press Enter or comma…" className="input" />
                <p className="text-xs text-gray-600">Press Enter or comma to add each keyword</p>
              </div>

              {/* Location + Salary */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Location">
                  <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                    placeholder="Lagos, London, NYC…" className="input" disabled={remoteOnly} />
                </Field>
                <Field label="Min. compensation (optional)">
                  <div className="flex gap-2">
                    <select value={salaryCurrency} onChange={(e) => setSalaryCurrency(e.target.value)} className="input w-24 shrink-0">
                      {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                    </select>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm select-none">{currencySymbol}</span>
                      <input type="number" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)}
                        placeholder="80,000" className="input pl-7" min={0} />
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Annual, in {salaryCurrency}</p>
                </Field>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} className="accent-blue-500" />
                Remote only
              </label>

              {/* Pre-built sources */}
              <Field label="Job sources">
                <div className="space-y-2 mt-1">
                  {JOB_SOURCES.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                      <input type="checkbox" checked={sources.includes(s.id)}
                        onChange={() => toggleArr(sources, setSources, s.id)} className="accent-blue-500" />
                      {s.label}
                    </label>
                  ))}
                </div>
              </Field>
            </div>

            {/* Custom job site URLs */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Custom job sites</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Paste any job board homepage or RSS feed URL. Hunt knows the RSS endpoints for popular boards
                  (Indeed, Jobberman, MyJobMag, RemoteOK, We Work Remotely, etc.) and will resolve them automatically.
                </p>
              </div>

              {customSources.length > 0 && (
                <div className="space-y-2">
                  {customSources.map((url) => (
                    <div key={url} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
                      <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                      </svg>
                      <span className="text-xs text-gray-300 flex-1 truncate">{url}</span>
                      <button type="button" onClick={() => setCustomSources((p) => p.filter((u) => u !== url))}
                        className="text-gray-600 hover:text-red-400 transition-colors shrink-0 text-sm">×</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="url"
                  value={customSourceInput}
                  onChange={(e) => setCustomSourceInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomSource(customSourceInput); setCustomSourceInput(""); } }}
                  placeholder="https://jobs.example.com/rss or https://company.com/careers"
                  className="input flex-1"
                />
                <button
                  type="button"
                  onClick={() => { addCustomSource(customSourceInput); setCustomSourceInput(""); }}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors shrink-0"
                >
                  Add
                </button>
              </div>
              <p className="text-xs text-gray-600">
                Supported: jobberman.com · myjobmag.com · fuzu.com · peepuu.com · hubstafftalent.net · hotnigerianjobs.com · boards.greenhouse.io/company · job-boards.eu.greenhouse.io/company · remoteok.com · and any RSS feed
              </p>
            </div>
          </>
        )}

        {/* SOCIAL criteria */}
        {type === "SOCIAL" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Social criteria</h2>
            <Field label="Topics (comma-separated)">
              <input type="text" value={topics} onChange={(e) => setTopics(e.target.value)}
                placeholder="React, TypeScript, Web3, Product" className="input" />
            </Field>
            <Field label="Platforms">
              <div className="space-y-2 mt-1">
                {SOCIAL_PLATFORMS.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={platforms.includes(p.id)}
                      onChange={() => toggleArr(platforms, setPlatforms, p.id)} className="accent-blue-500" />
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

        {/* Schedule */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Auto-run schedule</h2>
            <p className="text-xs text-gray-500 mt-1">Hunt will run automatically on Vercel. "Manual only" means you trigger it yourself.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "", label: "Manual only" },
              { value: "6h", label: "Every 6 hours" },
              { value: "12h", label: "Twice a day" },
              { value: "24h", label: "Daily" },
              { value: "168h", label: "Weekly" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setCronExpression(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  cronExpression === opt.value
                    ? "border-blue-500 bg-blue-500/10 text-blue-300"
                    : "border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Limits & approval */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Limits & approval</h2>
          <Field label={`Max per run: ${maxActionsPerRun}`} hint="Applications drafted per run">
            <input type="range" min={1} max={50} value={maxActionsPerRun}
              onChange={(e) => setMaxActionsPerRun(parseInt(e.target.value))} className="w-full accent-blue-500" />
          </Field>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={approvalRequired} onChange={(e) => setApprovalRequired(e.target.checked)} className="accent-blue-500 mt-0.5" />
            <div>
              <div className="text-sm text-gray-300 font-medium">Require my approval before sending</div>
              <div className="text-xs text-gray-500 mt-0.5">Drafts land in Applications for review. Uncheck for fully automated sending.</div>
            </div>
          </label>
        </div>

        {/* Run immediately — create only */}
        {mode === "create" && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={runNow} onChange={(e) => setRunNow(e.target.checked)} className="accent-blue-500 mt-0.5" />
              <div>
                <div className="text-sm text-white font-medium">Run immediately after creating</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Starts a scan right away. Cover letters are generated automatically — no separate worker needed.
                </div>
              </div>
            </label>
          </div>
        )}

        <div className="flex gap-3 pb-8">
          <button type="submit" disabled={loading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors">
            {loading ? (mode === "create" ? "Creating…" : "Saving…") : (mode === "create" ? "Create Hunt" : "Save Changes")}
          </button>
          <Link href="/dashboard/hunts"
            className="px-6 py-2.5 border border-gray-700 hover:border-gray-500 text-gray-300 font-semibold rounded-lg text-sm transition-colors">
            Cancel
          </Link>
        </div>
      </form>

      <style jsx global>{`
        .input { width:100%; background:#1f2937; border:1px solid #374151; border-radius:8px; padding:8px 12px; color:#f9fafb; font-size:14px; outline:none; transition:border-color .15s; }
        .input:focus { border-color:#3b82f6; }
        .input::placeholder { color:#6b7280; }
        .input:disabled { opacity:.4; cursor:not-allowed; }
        select.input option { background:#1f2937; }
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
