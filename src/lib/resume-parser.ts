import { parseResume as parseResumeWithClaude } from "./llm";

// pdf-parse is CommonJS only — dynamic import avoids Next.js ESM issues
async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // pdf-parse ships both CJS and ESM — handle both shapes
  const mod = await import("pdf-parse");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfParse: (buf: Buffer) => Promise<{ text: string }> = (mod as any).default ?? mod;
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
    // For .txt files decode directly; .doc/.docx would need mammoth — handle in a later phase
    text = buffer.toString("utf-8");
  } else {
    throw new Error(`Unsupported resume type: ${mimeType}`);
  }

  if (!text || text.trim().length < 50) {
    throw new Error("Could not extract text from resume — file may be empty or image-only");
  }

  const structured = await parseResumeWithClaude(text);

  return { text, structured };
}
