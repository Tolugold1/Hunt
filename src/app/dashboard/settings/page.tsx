import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/llm";
import LLMProviderPicker from "./LLMProviderPicker";
import MailboxManager from "./MailboxManager";

export default async function SettingsPage() {
  const session = await auth();
  const userId = session!.user!.id!;
  const mailboxes = await db.mailbox.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });

  const active = getProvider();
  const providers = [
    {
      id: "claude" as const,
      name: "Claude",
      vendor: "Anthropic",
      description: "Excellent at nuanced writing — great for tailored cover letters.",
      fastModel: "claude-haiku-4-5",
      fullModel: "claude-sonnet-4-6",
      configured: !!process.env.ANTHROPIC_API_KEY,
      envKey: "ANTHROPIC_API_KEY",
      docsUrl: "https://console.anthropic.com",
    },
    {
      id: "openai" as const,
      name: "ChatGPT",
      vendor: "OpenAI",
      description: "GPT-4o for full drafts, GPT-4o-mini for fast classification tasks.",
      fastModel: "gpt-4o-mini",
      fullModel: "gpt-4o",
      configured: !!process.env.OPENAI_API_KEY,
      envKey: "OPENAI_API_KEY",
      docsUrl: "https://platform.openai.com",
    },
    {
      id: "gemini" as const,
      name: "Gemini",
      vendor: "Google",
      description: "Gemini 1.5 Pro for writing, Flash for cheap + fast scoring.",
      fastModel: "gemini-1.5-flash",
      fullModel: "gemini-1.5-pro",
      configured: !!process.env.GEMINI_API_KEY,
      envKey: "GEMINI_API_KEY",
      docsUrl: "https://aistudio.google.com",
    },
  ];

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1 text-sm">Configure AI provider and integrations.</p>
      </div>

      <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="font-semibold text-white">AI Provider</h2>
          <p className="text-gray-400 text-sm mt-1">
            Hunt uses two tiers: a fast model for job scoring and a full model for writing cover letters and posts.
            All three providers are supported — switch anytime. Set the matching API key in your <code className="text-blue-400">.env</code>.
          </p>
        </div>

        <LLMProviderPicker active={active} providers={providers} />

        <div className="border-t border-gray-800 pt-4">
          <p className="text-xs text-gray-500">
            Switching here sets <code className="text-gray-400">LLM_PROVIDER</code> for the current process.
            To make it permanent, set <code className="text-gray-400">LLM_PROVIDER=claude|openai|gemini</code> in your <code className="text-gray-400">.env</code> and restart the server.
          </p>
        </div>
      </section>

      {/* Mailbox section */}
      <MailboxManager mailboxes={mailboxes.map((m) => ({ id: m.id, email: m.email, provider: m.provider, label: m.label, isDefault: m.isDefault }))} />

      <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold text-white">Document storage</h2>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-300">Cloudinary</div>
            <div className="text-xs text-gray-500">Resumes stored as raw assets · signed URL download</div>
          </div>
          <span className={`text-xs px-2 py-1 rounded font-medium ${
            process.env.CLOUDINARY_CLOUD_NAME
              ? "text-green-400 bg-green-500/10"
              : "text-yellow-400 bg-yellow-500/10"
          }`}>
            {process.env.CLOUDINARY_CLOUD_NAME ? "Configured" : "Not configured"}
          </span>
        </div>
      </section>
    </div>
  );
}
