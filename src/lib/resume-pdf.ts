/**
 * Render a plain-text / lightly-marked-up résumé into a clean, ATS-friendly PDF.
 * Pure pdf-lib (StandardFonts) — no native binaries or external font files, so it
 * runs fine on Vercel's serverless runtime.
 *
 * Markup understood (kept deliberately simple, matches what the LLM emits):
 *   # Heading            → section heading (bold, larger)
 *   - bullet / • bullet  → bullet line
 *   plain line           → body text
 *   blank line           → vertical gap
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 54;
const CONTENT_W = PAGE_W - MARGIN * 2;

const SIZE_BODY = 10.5;
const SIZE_HEADING = 13;
const SIZE_NAME = 20;
const LEADING = 1.35;

function wrapLine(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const trial = cur ? `${cur} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      cur = trial;
    } else {
      if (cur) lines.push(cur);
      // Word longer than the line: hard-split it.
      if (font.widthOfTextAtSize(word, size) > maxWidth) {
        let chunk = "";
        for (const ch of word) {
          if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) { lines.push(chunk); chunk = ch; }
          else chunk += ch;
        }
        cur = chunk;
      } else {
        cur = word;
      }
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function renderResumePdf(text: string, candidateName?: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  const draw = (
    raw: string,
    { f = font, size = SIZE_BODY, indent = 0, color = rgb(0.1, 0.1, 0.1), gapAfter = 0 }: { f?: PDFFont; size?: number; indent?: number; color?: ReturnType<typeof rgb>; gapAfter?: number } = {}
  ) => {
    const lineHeight = size * LEADING;
    const wrapped = wrapLine(raw, f, size, CONTENT_W - indent);
    for (const ln of wrapped) {
      ensureSpace(lineHeight);
      page.drawText(ln, { x: MARGIN + indent, y: y - size, size, font: f, color });
      y -= lineHeight;
    }
    y -= gapAfter;
  };

  const lines = text.replace(/\r/g, "").split("\n");
  let nameDrawn = false;

  // Optional name banner from the candidate name if the résumé text doesn't lead with one.
  if (candidateName && !lines[0]?.trim()) {
    draw(candidateName, { f: bold, size: SIZE_NAME, gapAfter: 6 });
    nameDrawn = true;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\s+$/g, "");
    if (!line.trim()) { y -= SIZE_BODY * 0.6; continue; }

    // First non-empty line, no explicit heading marker → treat as the name.
    if (!nameDrawn && i === 0 && !/^[#\-•*]/.test(line)) {
      draw(line.replace(/^#+\s*/, ""), { f: bold, size: SIZE_NAME, gapAfter: 4 });
      nameDrawn = true;
      continue;
    }

    if (/^#{1,3}\s+/.test(line) || /^[A-Z][A-Z \/&]{3,}$/.test(line.trim())) {
      const heading = line.replace(/^#{1,3}\s+/, "").trim();
      y -= 4;
      ensureSpace(SIZE_HEADING * LEADING + 6);
      draw(heading.toUpperCase(), { f: bold, size: SIZE_HEADING, color: rgb(0.12, 0.2, 0.45) });
      // underline rule
      ensureSpace(6);
      page.drawLine({ start: { x: MARGIN, y: y + 3 }, end: { x: PAGE_W - MARGIN, y: y + 3 }, thickness: 0.6, color: rgb(0.75, 0.8, 0.9) });
      y -= 4;
      continue;
    }

    if (/^\s*[-•*]\s+/.test(line)) {
      const item = line.replace(/^\s*[-•*]\s+/, "");
      const lineHeight = SIZE_BODY * LEADING;
      ensureSpace(lineHeight);
      page.drawText("•", { x: MARGIN + 6, y: y - SIZE_BODY, size: SIZE_BODY, font, color: rgb(0.3, 0.3, 0.3) });
      draw(item, { indent: 18 });
      continue;
    }

    // Role header line: "Job Title | Employer | Dates" → bold so positions stand out.
    if (line.includes(" | ")) {
      y -= 3;
      draw(line, { f: bold, size: SIZE_BODY + 0.5 });
      continue;
    }

    draw(line);
  }

  // useObjectStreams:false → a classic xref table that every PDF/ATS parser can
  // read (pdf-lib's default object streams break older extractors and some ATS).
  const bytes = await doc.save({ useObjectStreams: false });
  return Buffer.from(bytes);
}
