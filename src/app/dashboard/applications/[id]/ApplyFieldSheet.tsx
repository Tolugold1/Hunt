"use client";

import { useState } from "react";

export type ApplyField = { label: string; value: string; multiline?: boolean };

export default function ApplyFieldSheet({ fields }: { fields: ApplyField[] }) {
  const [copied, setCopied] = useState<number | null>(null); // field index, or -1 for "copy all"

  async function copy(text: string, key: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked — user can still select manually */
    }
  }

  if (!fields.length) return null;

  const copyAllText = fields.map((f) => `${f.label}: ${f.value}`).join("\n\n");

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-white">Quick-apply fields</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Prefilled answers for the fields application forms usually ask. Open the job link and paste each into the form.
          </p>
        </div>
        <button
          onClick={() => copy(copyAllText, -1)}
          className="shrink-0 text-xs px-2.5 py-1.5 border border-gray-700 hover:border-gray-500 text-gray-300 rounded-lg transition-colors"
        >
          {copied === -1 ? "Copied all ✓" : "Copy all"}
        </button>
      </div>

      <div className="border border-gray-800 rounded-lg divide-y divide-gray-800">
        {fields.map((f, i) => (
          <div key={f.label} className="flex items-start gap-3 p-3">
            <div className="w-28 sm:w-36 shrink-0 text-xs text-gray-500 pt-0.5">{f.label}</div>
            <div className={`flex-1 min-w-0 text-sm text-gray-200 ${f.multiline ? "whitespace-pre-wrap break-words" : "truncate"}`}>
              {f.value}
            </div>
            <button
              onClick={() => copy(f.value, i)}
              className="shrink-0 text-xs px-2 py-1 text-gray-400 hover:text-blue-400 border border-gray-700 hover:border-blue-500/50 rounded transition-colors"
            >
              {copied === i ? "Copied ✓" : "Copy"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
