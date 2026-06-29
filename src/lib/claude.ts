import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function parseResume(resumeText: string) {
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Extract structured information from this resume. Return ONLY valid JSON with these fields:
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
${resumeText}`,
      },
    ],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse resume JSON from Claude");
  return JSON.parse(jsonMatch[0]);
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
}) {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: `Write a concise, tailored cover letter email for this job application.

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
${resumeText.slice(0, 3000)}`,
      },
    ],
  });

  return msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
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
}) {
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 128,
    messages: [
      {
        role: "user",
        content: `Rate how well this candidate matches this job. Return ONLY a JSON object: {"score": 0.0, "reason": "brief reason"}
Score 0.0-1.0 (0 = no match, 1 = perfect match).

Candidate skills: ${skills.join(", ")}
Candidate titles: ${jobTitles.join(", ")}
Resume excerpt: ${resumeText.slice(0, 1000)}

Job description: ${jobDescription.slice(0, 1000)}`,
      },
    ],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { score: 0.5, reason: "Could not score" };
  return JSON.parse(jsonMatch[0]) as { score: number; reason: string };
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
}) {
  const platformGuidelines: Record<string, string> = {
    twitter: "Max 280 chars. Punchy opener. 2-3 relevant hashtags at end.",
    instagram: "Engaging caption. 5-10 hashtags at end after two line breaks.",
    linkedin: "3-4 paragraphs. Professional. Key insight. End with a question.",
    facebook: "Conversational. 2-3 paragraphs. Link preview will show.",
  };

  const guidelines = platformGuidelines[platform] ?? platformGuidelines.linkedin;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `Write a ${tone} social media post for ${platform} about this article, as ${userName}.

Guidelines: ${guidelines}
Do NOT copy the article verbatim — write commentary/your take with attribution.
Include the URL: ${articleUrl}
Return ONLY the post text, nothing else.

Article: ${articleTitle}
Summary: ${articleSummary}`,
      },
    ],
  });

  return msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
}
