"use client";

import { useState } from "react";
import Link from "next/link";

type RunState = "idle" | "loading" | "queued" | "error";

export default function RunHuntButton({ huntId, huntName }: { huntId: string; huntName: string }) {
  const [state, setState] = useState<RunState>("idle");
  const [errMsg, setErrMsg] = useState("");

  async function run() {
    setState("loading");
    setErrMsg("");
    try {
      const res = await fetch(`/api/hunts/${huntId}/run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErrMsg(data.error ?? "Failed to run hunt");
        setState("error");
        return;
      }
      setState("queued");
    } catch {
      setErrMsg("Network error — check your connection.");
      setState("error");
    }
  }

  if (state === "queued") {
    return (
      <div className="flex flex-col items-end gap-1.5 text-right">
        <span className="text-xs text-green-400 font-medium flex items-center gap-1">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Queued
        </span>
        <Link
          href={`/dashboard/applications?huntId=${huntId}`}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          View results →
        </Link>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col items-end gap-1 text-right max-w-[220px]">
        <span className="text-xs text-red-400 font-medium">Run failed</span>
        <p className="text-xs text-gray-500 leading-snug whitespace-pre-wrap">{errMsg}</p>
        <button
          onClick={run}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors mt-0.5"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={run}
      disabled={state === "loading"}
      className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors whitespace-nowrap"
    >
      {state === "loading" ? (
        <>
          <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Queuing…
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          Run now
        </>
      )}
    </button>
  );
}
