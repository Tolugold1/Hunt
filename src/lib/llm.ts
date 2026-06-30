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

export function getProvider(): LLMProvider {
  const p = process.env.LLM_PROVIDER?.toLowerCase();
  if (p === "openai" || p === "gemini") return p;
  return "claude"; // default
}

// ─── Internal: call the active provider ──────────────────────────────────────

export async function complete(prompt: string, opts: { fast?: boolean } = {}): Promise<string> {
  const provider = getProvider();

  if (provider === "openai") {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = opts.fast ? "gpt-4o-mini" : "gpt-4o";
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: opts.fast ? 512 : 1024,
    });
    return res.choices[0]?.message?.content?.trim() ?? "";
  }

  if (provider === "gemini") {
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
    const model = client.getGenerativeModel({
      model: opts.fast ? "gemini-1.5-flash" : "gemini-1.5-pro",
    });
    const res = await model.generateContent(prompt);
    return res.response.text().trim();
  }

  // Default: Claude (Anthropic)
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = opts.fast ? "claude-haiku-4-5-20251001" : "claude-sonnet-4-6";
  const res = await client.messages.create({
    model,
    max_tokens: opts.fast ? 512 : 1024,
    messages: [{ role: "user", content: prompt }],
  });
  return res.content[0].type === "text" ? res.content[0].text.trim() : "";
}

// ─── Public functions (provider-agnostic) ────────────────────────────────────

export async function parseResume(resumeText: string): Promise<{
  fullName?: string;
  headline?: string;
  summary?: string;
  skills?: string[];
  jobTitles?: string[];
  experienceYears?: number;
  location?: string;
}> {
  const prompt = `Extract structured information from this resume. Return ONLY valid JSON with these fields:
{
  "fullName": string,
  "headline": string,
  "summary": string,
  "skills": string[],
  "jobTitles": string[],
  "experienceYears": number,
  "location": string
}

Resume:
${resumeText}`;

  const text = await complete(prompt, { fast: true });
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Failed to parse resume JSON from LLM");
  return JSON.parse(match[0]);
}

export async function generateCoverLetter({
  jobTitle,
  company,
  jobDescription,
  resumeText,
  userName,
}: {
  jobTitle: string;
  company: string;
  jobDescription: string;
  resumeText: string;
  userName: string;
}): Promise<string> {
  const prompt = `Write a concise, tailored cover letter email for this job application.

RULES:
- Write as ${userName}
- Ground EVERY claim in the resume below — never invent experience
- Be specific, not generic ("I built X with Y" not "I have experience in")
- Tone: professional but warm, not stiff
- Length: 3 short paragraphs max
- Do NOT include "Dear Hiring Manager" — start with the first paragraph body
- Do NOT include a sign-off — end after the last paragraph
- Return ONLY the email body text, nothing else

JOB: ${jobTitle} at ${company}
DESCRIPTION:
${jobDescription.slice(0, 2000)}

RESUME:
${resumeText.slice(0, 3000)}`;

  return complete(prompt);
}

export async function scoreJobMatch({
  jobDescription,
  resumeText,
  skills,
  jobTitles,
}: {
  jobDescription: string;
  resumeText: string;
  skills: string[];
  jobTitles: string[];
}): Promise<{ score: number; reason: string }> {
  const prompt = `Rate how well this candidate matches this job. Return ONLY a JSON object: {"score": 0.0, "reason": "brief reason"}
Score 0.0-1.0 (0 = no match, 1 = perfect match).

Candidate skills: ${skills.join(", ")}
Candidate titles: ${jobTitles.join(", ")}
Resume excerpt: ${resumeText.slice(0, 1000)}

Job description: ${jobDescription.slice(0, 1000)}`;

  const text = await complete(prompt, { fast: true });
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { score: 0.5, reason: "Could not score" };
  return JSON.parse(match[0]);
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
