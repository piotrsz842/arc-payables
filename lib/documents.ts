/**
 * Turn an uploaded study-guide file into plain text the author can edit.
 *   .txt / .md → as is      .docx → mammoth (raw text)      .pdf → unpdf
 * Formatting (fonts, images) is dropped; the author reviews the text before publishing.
 */
import "server-only";

export const MAX_FILE_BYTES = 4 * 1024 * 1024; // Vercel's request limit is about 4.5 MB

export class UnsupportedFileError extends Error {}

export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  if (name.endsWith(".txt") || name.endsWith(".md")) return buffer.toString("utf8");
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }
  if (name.endsWith(".pdf")) {
    const { extractText: pdfText } = await import("unpdf");
    const { text } = await pdfText(new Uint8Array(buffer), { mergePages: true });
    return Array.isArray(text) ? text.join("\n\n") : text;
  }
  throw new UnsupportedFileError("Upload a .docx, .pdf, .txt or .md file.");
}
