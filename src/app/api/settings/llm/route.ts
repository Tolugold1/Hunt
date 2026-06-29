import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProvider } from "@/lib/llm";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    active: getProvider(),
    available: [
      {
        id: "claude",
        name: "Claude (Anthropic)",
        models: { fast: "claude-haiku-4-5", full: "claude-sonnet-4-6" },
        configured: !!process.env.ANTHROPIC_API_KEY,
      },
      {
        id: "openai",
        name: "ChatGPT (OpenAI)",
        models: { fast: "gpt-4o-mini", full: "gpt-4o" },
        configured: !!process.env.OPENAI_API_KEY,
      },
      {
        id: "gemini",
        name: "Gemini (Google)",
        models: { fast: "gemini-1.5-flash", full: "gemini-1.5-pro" },
        configured: !!process.env.GEMINI_API_KEY,
      },
    ],
  });
}

const Schema = z.object({
  provider: z.enum(["claude", "openai", "gemini"]),
});

// NOTE: This PATCH writes to a runtime env var for the current process only.
// For persistence, set LLM_PROVIDER in your .env file and restart.
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  process.env.LLM_PROVIDER = parsed.data.provider;
  return NextResponse.json({ active: parsed.data.provider });
}
