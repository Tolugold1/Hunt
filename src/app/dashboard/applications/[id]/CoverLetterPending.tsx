"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// If a draft has had no cover letter for this long, treat generation as stuck.
const STUCK_AFTER_MS = 2 * 60 * 1000; // 2 minutes
const POLL_INTERVAL_MS = 8000;

export default function CoverLetterPending({
  applicationId,
  createdAtMs,
  failed = false,
}: {
  applicationId: string;
  createdAtMs: number;
  failed?: boolean;
}) {
  const router = useRouter();
  const [now, setNow] = useState(createdAtMs); // real value set on mount to avoid SSR mismatch
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const ageMs = now - createdAtMs;
  // A recorded failure is definitively stuck; otherwise fall back to the age heuristic.
  const stuck = failed || ageMs > STUCK_AFTER_MS;

  // Poll for the cover letter appearing (worker finished, or another tab regenerated).
  useEffect(() => {
    mounted.current = true;
    setNow(Date.now());

    const tick = setInterval(() => {
      if (mounted.current) setNow(Date.now());
    }, 1000);

    // No point polling a generation we already know failed — the user must regenerate.
    const poll = failed
      ? null
      : setInterval(async () => {
          try {
            const res = await fetch(`/api/applications/${applicationId}`, { cache: "no-store" });
            if (!res.ok) return;
            const data = await res.json();
            if (data.coverLetter) router.refresh();
          } catch {
            /* transient — keep polling */
          }
        }, POLL_INTERVAL_MS);

    return () => {
      mounted.current = false;
      clearInterval(tick);
      if (poll) clearInterval(poll);
    };
  }, [applicationId, router, failed]);

  async function regenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to regenerate.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      if (mounted.current) setRegenerating(false);
    }
  }

  return (
    <div className="space-y-3">
      {!stuck ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <svg className="w-4 h-4 animate-spin text-yellow-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Generating your cover letter… this usually takes 10–30 seconds.
        </div>
      ) : (
        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 text-sm text-yellow-300">
          Generation is taking longer than expected — it may have failed (an AI quota
          limit or a network hiccup). You can regenerate it now.
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={regenerate}
          disabled={regenerating}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {regenerating ? "Regenerating…" : stuck ? "Regenerate now" : "Regenerate"}
        </button>
        {!stuck && (
          <span className="text-xs text-gray-600">
            Checking automatically every few seconds…
          </span>
        )}
      </div>

      {error && <div className="text-sm text-red-400">{error}</div>}
    </div>
  );
}
