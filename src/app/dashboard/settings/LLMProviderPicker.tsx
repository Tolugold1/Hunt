"use client";

import { useState } from "react";
import type { LLMProvider } from "@/lib/llm";

type Provider = {
  id: LLMProvider;
  name: string;
  vendor: string;
  description: string;
  fastModel: string;
  fullModel: string;
  configured: boolean;
  envKey: string;
  docsUrl: string;
};

export default function LLMProviderPicker({
  active,
  providers,
}: {
  active: LLMProvider;
  providers: Provider[];
}) {
  const [selected, setSelected] = useState<LLMProvider>(active);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/settings/llm", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: selected }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-3">
      {providers.map((p) => (
        <button
          key={p.id}
          onClick={() => setSelected(p.id)}
          className={`w-full text-left rounded-xl border p-4 transition-colors ${
            selected === p.id
              ? "border-blue-500 bg-blue-500/5"
              : "border-gray-700 hover:border-gray-600"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white text-sm">{p.name}</span>
                <span className="text-gray-500 text-xs">by {p.vendor}</span>
                {selected === p.id && (
                  <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded font-medium">
                    active
                  </span>
                )}
              </div>
              <p className="text-gray-400 text-xs">{p.description}</p>
              <div className="flex gap-3 mt-1.5 text-xs text-gray-500">
                <span>Fast: <code className="text-gray-400">{p.fastModel}</code></span>
                <span>Full: <code className="text-gray-400">{p.fullModel}</code></span>
              </div>
            </div>
            <div className="flex-shrink-0 text-right space-y-1">
              <div className={`text-xs font-medium ${p.configured ? "text-green-400" : "text-yellow-400"}`}>
                {p.configured ? "Key set" : "No key"}
              </div>
              {!p.configured && (
                <a
                  href={p.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-blue-400 hover:underline block"
                >
                  Get key →
                </a>
              )}
            </div>
          </div>
          {!p.configured && (
            <div className="mt-2 text-xs text-yellow-400/70">
              Add <code className="text-yellow-300">{p.envKey}=&quot;...&quot;</code> to your .env
            </div>
          )}
        </button>
      ))}

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={save}
          disabled={saving || selected === active}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {saved && <span className="text-green-400 text-sm">Saved — restart workers to apply.</span>}
      </div>
    </div>
  );
}
