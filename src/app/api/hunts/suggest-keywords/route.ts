import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { complete } from "@/lib/llm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobTitle } = await req.json();
  if (!jobTitle?.trim()) return NextResponse.json({ keywords: [] });

  const prompt = `You are helping a job seeker set up an automated job search.

Job title they want to hunt for: "${jobTitle.trim()}"

Generate a list of 6–10 search keywords that will find relevant jobs for this role. Include:
- Common variations of the job title
- Key technical skills typically required
- Common adjacent titles that would also match

Return ONLY a JSON array of strings, no explanation. Example:
["Backend Developer", "Node.js Engineer", "API Developer", "TypeScript", "Node.js", "REST API", "GraphQL"]`;

  const raw = await complete(prompt, { fast: true });

  let keywords: string[] = [];
  try {
    const match = raw.match(/\[[\s\S]*?\]/);
    if (match) keywords = JSON.parse(match[0]);
  } catch {
    keywords = [];
  }

  return NextResponse.json({ keywords });
}
