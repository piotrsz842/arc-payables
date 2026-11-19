/**
 * One handwritten page → stored privately + transcribed.
 * POST multipart { photo } → { path, url, text, legibility, issues, darkPhoto }
 * (The browser shrinks photos first and sends one page per request: Vercel
 * limits request bodies to about 4.5 MB.)
 */
import { getCurrentUser } from "@/lib/auth";
import { MAX_BYTES, signedPhotoUrl, transcribePage } from "@/lib/handwritten";
import { db } from "@/lib/supabase/admin";

export const maxDuration = 120;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const photo = form?.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return Response.json({ error: "Add a photo." }, { status: 400 });
  if (photo.size > MAX_BYTES) return Response.json({ error: "That photo is too large." }, { status: 413 });
  if (!photo.type.startsWith("image/")) return Response.json({ error: "That isn't an image." }, { status: 415 });
  try {
    const page = await transcribePage(db, user.id, Buffer.from(await photo.arrayBuffer()));
    return Response.json({ ...page, url: await signedPhotoUrl(db, page.path) });
  } catch (err) {
    console.error("Transcription failed:", err);
    return Response.json({ error: "We couldn't read that photo. Try a clearer, brighter one." }, { status: 500 });
  }
}
