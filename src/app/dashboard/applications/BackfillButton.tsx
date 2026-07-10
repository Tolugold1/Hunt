"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Loop the batched backfill until the server reports done (cap iterations as a
// safety net so a stuck row can't spin forever).
const MAX_ITERATIONS = 60;

export default function BackfillButton({ count }: { count: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  async function run() {
    setRunning(true);
    setFinished(false);
    let fixed = 0;
    let regenerated = 0;
    try {
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const res = await fetch("/api/applications/backfill", { method: "POST" });
        if (!res.ok) {
          setMsg("Something went wrong — some jobs may have been fixed. Try again.");
          break;
        }
        const d = await res.json();
        fixed += d.fixed ?? 0;
        regenerated += d.regenerated ?? 0;
        if (d.done) {
          setMsg(`Done — fixed ${fixed} job${fixed !== 1 ? "s" : ""}, regenerated ${regenerated} cover letter${regenerated !== 1 ? "s" : ""}.`);
          setFinished(true);
          break;
        }
        setMsg(`Fixing… ${fixed} done, ${d.remaining ?? 0} to go`);
      }
    } catch {
      setMsg("Network error — some jobs may have been fixed. Try again.");
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
      <div className="text-sm text-yellow-200 leading-snug">
        {msg ??
          `${count} imported X job${count !== 1 ? "s" : ""} may have the wrong company or apply method from an earlier bug. Re-process to fix classification, title, and cover letters.`}
      </div>
      {!finished && (
        <button
          onClick={run}
          disabled={running}
          className="shrink-0 self-start sm:self-auto px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          {running ? "Fixing…" : "Fix them"}
        </button>
      )}
    </div>
  );
}
