/**
 * Publish a handwritten study guide after the author checked the transcription.
 * POST { course, title, ownWork: true, pages: [{ path, text }] } → { noteId }
 * The text goes through exactly the same steps as a typed upload (sections,
 * previews, near-duplicate check, pricing). The photos stay private.
 */
import { getCurrentUser } from "@/lib/auth";
import { MAX_PAGES } from "@/lib/handwritten";
import { DuplicateContentError, saveNote } from "@/lib/notes";
import { db } from "@/lib/supabase/admin";

export const maxDuration = 120;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as {
    course?: string; title?: string; ownWork?: boolean; pages?: { path?: string; text?: string }[];
  } | null;
  const course = String(body?.course ?? "").trim();
  const title = String(body?.title ?? "").trim();
  const pages = (body?.pages ?? []).slice(0, MAX_PAGES);
  if (!course || !title || pages.length === 0) return Response.json({ error: "Add a course, a title and at least one page." }, { status: 400 });
  if (body?.ownWork !== true) return Response.json({ error: "Confirm this is your own work in your own words." }, { status: 400 });
  // Only your own photos: every path must be inside your folder.
  if (pages.some((p) => typeof p.path !== "string" || !p.path.startsWith(`${user.id}/`))) {
    return Response.json({ error: "Those pages aren't yours." }, { status: 403 });
  }
  const text = pages.map((p) => String(p.text ?? "").trim()).filter(Boolean).join("\n\n");
  if (!text) return Response.json({ error: "The transcription is empty." }, { status: 400 });
  if (text.length > 60_000) return Response.json({ error: "That's too long for one study guide." }, { status: 400 });

  try {
    const { noteId } = await saveNote(db, {
      authorId: user.id, course, title, body: text, ownWorkConfirmed: true,
      handwritten: true, imagePaths: pages.map((p) => p.path!),
    });
    return Response.json({ noteId });
  } catch (err) {
    if (err instanceof DuplicateContentError) return Response.json({ error: err.message }, { status: 409 });
    console.error("Handwritten publish failed:", err);
    return Response.json({ error: "Something went wrong saving your study guide. Please try again." }, { status: 500 });
  }
}
