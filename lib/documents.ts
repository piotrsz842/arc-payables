/**
 * Turn an uploaded study-guide file into plain text the author can edit.
 *   .txt / .md → as is
 *   .docx      → mammoth, KEEPING the document's headings: Word / Google Docs
 *                "Heading 1-6" become "#" headings, which split the guide into
 *                sections (auto-sectioning is only for documents without
 *                headings). The "Title" style fills the form's Title field.
 *   .pdf       → unpdf (PDFs carry no reliable heading information)
 * Formatting (fonts, images) is dropped; the author reviews the text before publishing.
 */
import "server-only";

export const MAX_FILE_BYTES = 4 * 1024 * 1024; // Vercel's request limit is about 4.5 MB

export class UnsupportedFileError extends Error {}

// Word and Google Docs name these styles differently ("Heading 1" vs "heading 1").
const STYLE_MAP = [
  // The document's Title is the guide's name, not a section.
  "p[style-name='Title'] => p.doc-title:fresh",
  "p[style-name='title'] => p.doc-title:fresh",
  ...[1, 2, 3, 4, 5, 6].flatMap((n) => [`p[style-name='Heading ${n}'] => h${n}:fresh`, `p[style-name='heading ${n}'] => h${n}:fresh`]),
];

const TITLE_PARAGRAPH = /<p class="doc-title">([\s\S]*?)<\/p>/i;

export async function extractText(file: File): Promise<string> {
  return (await extractDocument(file)).text;
}

/** The text, plus the document's own title when it has one (.docx "Title" style). */
export async function extractDocument(file: File): Promise<{ text: string; title?: string }> {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  if (name.endsWith(".txt") || name.endsWith(".md")) return { text: buffer.toString("utf8") };
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value: html } = await mammoth.convertToHtml({ buffer }, { styleMap: STYLE_MAP });
    const titleHtml = html.match(TITLE_PARAGRAPH)?.[1];
    const title = titleHtml ? htmlToMarkdown(titleHtml) : undefined;
    return { text: htmlToMarkdown(html.replace(new RegExp(TITLE_PARAGRAPH.source, "gi"), "")), title: title || undefined };
  }
  if (name.endsWith(".pdf")) {
    const { extractText: pdfText } = await import("unpdf");
    const { text } = await pdfText(new Uint8Array(buffer), { mergePages: true });
    return { text: Array.isArray(text) ? text.join("\n\n") : text };
  }
  throw new UnsupportedFileError("Upload a .docx, .pdf, .txt or .md file.");
}

/** mammoth's simple HTML → the Markdown we use: # headings, - list items, blank lines between paragraphs. */
export function htmlToMarkdown(html: string): string {
  const strip = (s: string) =>
    s
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .trim();
  return html
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level: string, inner: string) => `\n\n${"#".repeat(Number(level))} ${strip(inner)}\n\n`)
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, inner: string) => `\n- ${strip(inner)}`)
    .replace(/<\/(p|ul|ol|table|tr)>/gi, "\n\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .split("\n")
    .map((line) => strip(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
