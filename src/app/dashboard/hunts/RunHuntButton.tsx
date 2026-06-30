"use client";

import { useState } from "react";
import Link from "next/link";

interface RunResult {
  fetched: number;
  matched: number;
  created: number;
  skipped: number;
  sources: string[];
  errors: string[];
  coverLettersQueued: number;
  queueError: string | null;
}

type RunState = "idle" | "running" | "done" | "error";

export default function RunHuntButton({ huntId, huntName }: { huntId: string; huntName: string }) {
  const [state, setState] = useState<RunState>("idle");
  const [result, setResult] = useState<RunResult | null>(null);
  const [errMsg, setErrMsg] = useState("");

  async function run() {
    setState("running");
    setResult(null);
    setErrMsg("");
    try {
      const res = await fetch(`/api/hunts/${huntId}/run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErrMsg(data.error ?? "Failed to run hunt");
        setState("error");
        return;
      }
      setResult(data as RunResult);
      setState("done");
    } catch {
      setErrMsg("Network error — check your connection.");
      setState("error");
    }
  }

  if (state === "running") {
    return (
      <div className="flex flex-col items-end gap-1 text-right">
        <span className="text-xs text-blue-400 flex items-center gap-1.5">
          <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Scanning job boards…
        </span>
        <span className="text-xs text-gray-600">This may take 10–20 seconds</span>
      </div>
    );
  }

  if (state === "done" && result) {
    return (
      <div className="flex flex-col items-end gap-1.5 text-right max-w-[200px]">
        <div className="flex items-center gap-1 text-xs text-green-400 font-medium">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {result.created > 0
            ? `${result.created} new draft${result.created !== 1 ? "s" : ""} created`
            : result.fetched === 0
            ? "No jobs found — check sources"
            : "No new matches"}
        </div>
        {result.sources.length > 0 && (
          <span className="text-xs text-gray-600">
            From: {result.sources.join(", ")}
          </span>
        )}
        {result.fetched > 0 && (
          <span className="text-xs text-gray-600">
            {result.fetched} fetched → {result.matched} matched
          </span>
        )}
        {result.coverLettersQueued > 0 && (
          <span className="text-xs text-blue-500">
            ✉ {result.coverLettersQueued} cover letter{result.coverLettersQueued !== 1 ? "s" : ""} queuing…
          </span>
        )}
        {result.queueError && (
          <span className="text-xs text-yellow-600 leading-snug">
            Workers offline — start with: npm run workers
          </span>
        )}
        {result.errors.length > 0 && (
          <details className="text-left">
            <summary className="text-xs text-yellow-600 cursor-pointer select-none">
              {result.errors.length} issue{result.errors.length !== 1 ? "s" : ""} — click to see
            </summary>
            <ul className="mt-1 space-y-0.5">
              {result.errors.map((e, i) => (
                <li key={i} className="text-xs text-gray-500 leading-snug">{e}</li>
              ))}
            </ul>
          </details>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          {result.created > 0 && (
            <Link
              href={`/dashboard/applications?huntId=${huntId}`}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              View drafts →
            </Link>
          )}
          <button
            onClick={run}
            className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
          >
            Run again
          </button>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col items-end gap-1 text-right max-w-[220px]">
        <span className="text-xs text-red-400 font-medium">Run failed</span>
        <p className="text-xs text-gray-500 leading-snug">{errMsg}</p>
        <button onClick={run} className="text-xs text-blue-400 hover:text-blue-300 transition-colors mt-0.5">
          Retry
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={run}
      className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z" />
      </svg>
      Run now
    </button>
  );
}
