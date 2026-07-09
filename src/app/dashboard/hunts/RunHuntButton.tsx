"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface RunResult {
  fetched: number;
  matched: number;
  created: number;
  skipped: number;
  sources: string[];
  errors: string[];
  coverLettersQueued: number;
}

type RunState = "idle" | "running" | "done" | "error" | "slow";

// Safety net: if the request hasn't returned by now, stop spinning and tell the
// user their jobs are being created in the background (discovery already ran).
const RUN_TIMEOUT_MS = 100_000;

export default function RunHuntButton({ huntId, huntName }: { huntId: string; huntName: string }) {
  const router = useRouter();
  const [state, setState] = useState<RunState>("idle");
  const [result, setResult] = useState<RunResult | null>(null);
  const [errMsg, setErrMsg] = useState("");

  async function run() {
    setState("running");
    setResult(null);
    setErrMsg("");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS);
    try {
      const res = await fetch(`/api/hunts/${huntId}/run`, { method: "POST", signal: controller.signal });
      const data = await res.json();
      if (!res.ok) {
        setErrMsg(data.error ?? "Failed to run hunt");
        setState("error");
        return;
      }
      setResult(data as RunResult);
      setState("done");
      router.refresh(); // update the hunt card's last-run / counts
    } catch (err) {
      // Aborted by our timeout, or the serverless function ran past its limit —
      // jobs were already created during discovery, so guide the user to them.
      if (err instanceof DOMException && err.name === "AbortError") {
        setState("slow");
      } else {
        setErrMsg("Network error — check your connection.");
        setState("error");
      }
      router.refresh();
    } finally {
      clearTimeout(timer);
    }
  }

  if (state === "running") {
    return (
      <div className="flex flex-col items-start sm:items-end gap-1 text-left sm:text-right">
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
      <div className="flex flex-col items-start sm:items-end gap-1.5 text-left sm:text-right max-w-full sm:max-w-[200px]">
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
            ✉ {result.coverLettersQueued} cover letter{result.coverLettersQueued !== 1 ? "s" : ""} ready
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

  if (state === "slow") {
    return (
      <div className="flex flex-col sm:items-end gap-1 text-left sm:text-right max-w-full sm:max-w-[220px]">
        <span className="text-xs text-blue-400 font-medium">Still processing…</span>
        <p className="text-xs text-gray-500 leading-snug">
          Your jobs are being created. Open Applications to see them as they finish.
        </p>
        <div className="flex items-center gap-3 mt-0.5">
          <Link
            href={`/dashboard/applications?huntId=${huntId}`}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            View drafts →
          </Link>
          <button onClick={run} className="text-xs text-gray-500 hover:text-gray-400 transition-colors">
            Run again
          </button>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col sm:items-end gap-1 text-left sm:text-right max-w-full sm:max-w-[220px]">
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
