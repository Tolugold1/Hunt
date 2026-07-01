"use client";

import { useState } from "react";

type Provider = "claude" | "openai" | "gemini";

const PROVIDERS: { id: Provider; name: string; model: string; icon: string }[] = [
  { id: "claude", name: "Claude", model: "Anthropic Sonnet", icon: "🟠" },
  { id: "openai", name: "GPT-4o", model: "OpenAI", icon: "🟢" },
  { id: "gemini", name: "Gemini", model: "Google", icon: "🔵" },
];

export default function AIProviderSelector({ current }: { current: string }) {
  const [selected, setSelected] = useState<Provider>(current as Provider || "claude");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(provider: Provider) {
    setSelected(provider);
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiProvider: provider }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-white">AI Provider</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Used for cover letters and job matching. Auto-falls back to the next if quota is exhausted.
          </p>
        </div>
        {saving && <span className="text-xs text-gray-500">Saving…</span>}
        {saved && <span className="text-xs text-green-400">Saved</span>}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => save(p.id)}
            disabled={saving}
            className={`rounded-xl border p-4 text-left transition-colors disabled:opacity-50 ${
              selected === p.id
                ? "border-blue-500 bg-blue-500/10"
                : "border-gray-700 hover:border-gray-600"
            }`}
          >
            <div className="text-xl mb-1.5">{p.icon}</div>
            <div className="font-semibold text-sm text-white">{p.name}</div>
            <div className="text-xs text-gray-500 mt-0.5">{p.model}</div>
            {selected === p.id && (
              <div className="text-xs text-blue-400 mt-1.5 font-medium">Primary</div>
            )}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-600">
        Fallback order: GPT-4o → Gemini → Claude. Make sure the API key for each is set in your environment.
      </p>
    </div>
  );
}
