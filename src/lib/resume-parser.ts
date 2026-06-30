import { parseResume as parseResumeWithLLM } from "./llm";

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // pdf-parse is a CJS module — listed in serverExternalPackages so Next.js
  // doesn't bundle it, which means require() works correctly here.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
  const data = await pdfParse(buffer);
  return data.text;
}

export async function parseResumeFile(buffer: Buffer, mimeType: string) {
  let text: string;

  if (mimeType === "application/pdf") {
    text = await extractTextFromPdf(buffer);
  } else if (
    mimeType === "text/plain" ||
    mimeType === "application/msword" ||
    mimeType.includes("wordprocessingml")
  ) {
    text = buffer.toString("utf-8");
  } else {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  if (!text || text.trim().length < 50) {
    throw new Error("Could not extract text — file may be empty or image-only");
  }

  const structured = await parseResumeWithLLM(text);
  return { text, structured };
}
