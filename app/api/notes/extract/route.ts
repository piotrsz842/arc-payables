/** Uploaded file (.docx, .pdf, .txt, .md) → its text (and title, if any), for the author to review. POST multipart { file } */
import { getCurrentUser } from "@/lib/auth";
import { extractDocument, MAX_FILE_BYTES, UnsupportedFileError } from "@/lib/documents";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!(await getCurrentUser())) return Response.json({ error: "Please sign in." }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Choose a file." }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return Response.json({ error: "That file is too large (max 4 MB)." }, { status: 413 });
  try {
    const doc = await extractDocument(file);
    const text = doc.text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!text) return Response.json({ error: "We couldn't find any text in that file. Is it a scan? Try the handwritten upload." }, { status: 422 });
    return Response.json({ text: text.slice(0, 60_000), title: doc.title?.slice(0, 120) });
  } catch (err) {
    if (err instanceof UnsupportedFileError) return Response.json({ error: err.message }, { status: 415 });
    console.error("File extraction failed:", err);
    return Response.json({ error: "We couldn't read that file." }, { status: 500 });
  }
}
