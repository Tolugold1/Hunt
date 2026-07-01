/**
 * Multi-provider LLM abstraction.
 * Supports Claude (Anthropic), ChatGPT (OpenAI), and Gemini (Google).
 *
 * Usage: set LLM_PROVIDER in .env to "claude" | "openai" | "gemini"
 * Default: "claude"
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type LLMProvider = "claude" | "openai" | "gemini";

export const PROVIDER_LABELS: Record<LLMProvider, string> = {
  claude: "Claude (Anthropic)",
  openai: "GPT-4 (OpenAI)",
  gemini: "Gemini (Google)",
};

const FALLBACK_ORDER: LLMProvider[] = ["claude", "openai", "gemini"];

export function getProvider(override?: string | null): LLMProvider {
  const p = (override ?? process.env.LLM_PROVIDER ?? "").toLowerCase();
  if (p === "openai" || p === "gemini" || p === "claude") return p;
  return "gemini";
}

function isQuotaError(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err).toLowerCase();
  return (
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("429") ||
    msg.includes("insufficient_quota") ||
    msg.includes("credit") ||
    msg.includes("overloaded") ||
    msg.includes("could not resolve authentication") ||
    msg.includes("api key") ||
    msg.includes("unauthorized") ||
    msg.includes("authentication")
  );
}

// ─── JSON extraction — handles code fences and raw JSON ──────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractJSON(text: string): any | null {
  // Strategy 1: content between ``` fences (handles ```json ... ```)
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch {}
  }
  // Strategy 2: find the outermost { ... } in the raw text
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return null;
}

// ─── Internal: call the active provider ──────────────────────────────────────

async function completeWithProvider(
  provider: LLMProvider,
  prompt: string,
  opts: { fast?: boolean; maxTokens?: number; prefill?: string }
): Promise<string> {
  const maxTokens = opts.maxTokens ?? (opts.fast ? 512 : 1024);

  if (provider === "openai") {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = opts.fast ? "gpt-4o-mini" : "gpt-4o";
    const messages: { role: "user" | "assistant"; content: string }[] = [
      { role: "user", content: prompt },
    ];
    if (opts.prefill) messages.push({ role: "assistant", content: opts.prefill });
    const res = await client.chat.completions.create({ model, messages, max_tokens: maxTokens });
    const text = res.choices[0]?.message?.content?.trim() ?? "";
    return opts.prefill ? opts.prefill + text : text;
  }

  if (provider === "gemini") {
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
    const model = client.getGenerativeModel({ model: opts.fast ? "gemini-1.5-flash" : "gemini-1.5-pro" });
    const res = await model.generateContent(prompt);
    return res.response.text().trim();
  }

  // Default: Claude (Anthropic) — supports assistant prefill to enforce output format
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = opts.fast ? "claude-haiku-4-5-20251001" : "claude-sonnet-4-6";
  const messages: { role: "user" | "assistant"; content: string }[] = [
    { role: "user", content: prompt },
  ];
  if (opts.prefill) messages.push({ role: "assistant", content: opts.prefill });
  const res = await client.messages.create({ model, max_tokens: maxTokens, messages });
  const text = res.content[0].type === "text" ? res.content[0].text.trim() : "";
  return opts.prefill ? opts.prefill + text : text;
}

// ─── Public complete() with auto-fallback on quota errors ────────────────────

export async function complete(
  prompt: string,
  opts: { fast?: boolean; maxTokens?: number; prefill?: string; provider?: string | null } = {}
): Promise<string> {
  const preferred = getProvider(opts.provider);
  // Build fallback chain: preferred first, then the others in order
  const chain: LLMProvider[] = [
    preferred,
    ...FALLBACK_ORDER.filter((p) => p !== preferred),
  ];

  let lastErr: unknown;
  for (const provider of chain) {
    try {
      return await completeWithProvider(provider, prompt, opts);
    } catch (err) {
      if (isQuotaError(err)) {
        console.warn(`[llm] ${provider} quota/rate-limit — trying next provider`);
        lastErr = err;
        continue;
      }
      throw err; // non-quota errors bubble up immediately
    }
  }
  throw lastErr ?? new Error("All LLM providers failed");
}

// ─── Public functions (provider-agnostic) ────────────────────────────────────

export async function parseResume(resumeText: string, provider?: string | null): Promise<{
  fullName?: string;
  headline?: string;
  summary?: string;
  skills?: string[];
  jobTitles?: string[];
  experienceYears?: number;
  location?: string;
  phone?: string;
  linkedInUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
}> {
  const prompt = `Extract structured information from this resume. Return ONLY valid JSON with these exact fields (use null for missing fields):
{
  "fullName": string,
  "headline": string,
  "summary": string,
  "skills": string[],
  "jobTitles": string[],
  "experienceYears": number,
  "location": string,
  "phone": string,
  "linkedInUrl": string,
  "githubUrl": string,
  "portfolioUrl": string
}

Resume:
${resumeText}`;

  const raw = await complete(prompt, { fast: true, provider });
  const parsed = extractJSON(raw);
  if (!parsed) throw new Error("LLM did not return JSON. Response: " + raw.slice(0, 200));
  // Ensure array fields are arrays even if LLM returned null
  if (!Array.isArray(parsed.skills)) parsed.skills = [];
  if (!Array.isArray(parsed.jobTitles)) parsed.jobTitles = [];
  return parsed;
}

export async function generateCoverLetter({
  jobTitle,
  company,
  jobDescription,
  resumeText,
  userName,
  provider,
}: {
  jobTitle: string;
  company: string;
  jobDescription: string;
  resumeText: string;
  userName: string;
  provider?: string | null;
}): Promise<string> {
  const prompt = `You are completing a cover letter for ${userName} applying for "${jobTitle}" at ${company}.

OUTPUT RULES:
- Output ONLY the finished letter — no preamble, no commentary, no markdown.
- Every bullet point and claim MUST come from the resume. Never invent skills or achievements.
- Be specific and concrete: "Built X using Y, achieving Z" not "I have experience with Y".
- The STATIC lines below must appear EXACTLY as written — do not paraphrase them.
- Replace every <FILL: ...> with the appropriate content drawn from the resume and job description.

════════════ LETTER (output this exactly, replacing <FILL> tags) ════════════

Dear Hiring Manager,

I am writing to express my interest in the ${jobTitle} position at ${company}.

<FILL: 2-3 sentences. State total years of experience, name the core technologies from the resume (be specific — list actual frameworks/languages), and describe the types of systems or products built. Ground every word in the resume.>

In my recent roles, I have:

• <FILL: Most impressive technical achievement — include a metric or scale if the resume has one>
• <FILL: Second achievement in a different skill area>
• <FILL: Achievement most relevant to this specific job description>
• <FILL: Achievement showing breadth — e.g. frontend, DevOps, AI, testing, or leadership>
• <FILL: Achievement showing collaboration, delivery, or business impact>

<FILL: 2 sentences explaining why ${company} specifically excites you. Reference something concrete from the job description.>

Please find my CV attached for your review. I would welcome the opportunity to discuss how my experience can contribute to ${company}'s continued success.

Thank you for your time and consideration. I look forward to hearing from you.

Kind regards,

${userName}

════════════════════════════════════════════════════════════════════════════════

JOB: ${jobTitle} at ${company}
JOB DESCRIPTION:
${jobDescription.slice(0, 2000)}

RESUME:
${resumeText.slice(0, 3000)}`;

  return complete(prompt, { maxTokens: 1800, provider });
}

export async function scoreJobMatch({
  jobDescription,
  resumeText,
  skills,
  jobTitles,
  provider,
}: {
  jobDescription: string;
  resumeText: string;
  skills: string[];
  jobTitles: string[];
  provider?: string | null;
}): Promise<{ score: number; reason: string }> {
  const prompt = `Score how well this candidate matches this job posting. Return ONLY valid JSON: {"score": 0.0, "reason": "one sentence"}

Scoring rules (score 0.0–1.0):
- START at 0.5 (neutral)
- INCREASE if: candidate's skills/titles directly match what the job requires
- DECREASE heavily if: the job's PRIMARY required technology stack is absent from candidate's skills
  (e.g. job requires PHP/Laravel but candidate only knows Node.js/Python → score ≤ 0.3)
- DECREASE if: seniority mismatch (job wants 8+ years, candidate has 2)
- INCREASE if: candidate has most required technologies and relevant job titles
- Score < 0.45 means auto-reject — only score that low if the candidate clearly cannot do this job

Candidate skills: ${skills.length ? skills.join(", ") : "unknown"}
Candidate job titles: ${jobTitles.length ? jobTitles.join(", ") : "unknown"}
Resume excerpt: ${resumeText.slice(0, 1500)}

Job posting:
${jobDescription.slice(0, 1500)}`;

  const raw = await complete(prompt, { fast: true, provider });
  const parsed = extractJSON(raw);
  if (!parsed) return { score: 0.5, reason: "Could not score" };
  return parsed as { score: number; reason: string };
}

export async function generateSocialPost({
  platform,
  articleTitle,
  articleUrl,
  articleSummary,
  tone = "professional",
  userName,
}: {
  platform: string;
  articleTitle: string;
  articleUrl: string;
  articleSummary: string;
  tone?: string;
  userName: string;
}): Promise<string> {
  const guidelines: Record<string, string> = {
    twitter: "Max 280 chars. Punchy opener. 2-3 relevant hashtags at end.",
    instagram: "Engaging caption. 5-10 hashtags at end after two line breaks.",
    linkedin: "3-4 paragraphs. Professional. Key insight. End with a question.",
    facebook: "Conversational. 2-3 paragraphs. Link preview will show.",
  };

  const prompt = `Write a ${tone} social media post for ${platform} about this article, as ${userName}.

Guidelines: ${guidelines[platform] ?? guidelines.linkedin}
Do NOT copy the article verbatim — write commentary/your take with attribution.
Include the URL: ${articleUrl}
Return ONLY the post text, nothing else.

Article: ${articleTitle}
Summary: ${articleSummary}`;

  return complete(prompt);
}
