/**
 * Throw away photos from a handwritten upload that was cancelled, or a page
 * the author removed. POST { paths: string[] } → { removed }
 * Also sent by the browser (sendBeacon) when the author leaves the page
 * without publishing, so unpublished photos don't pile up in storage.
 */
import { getCurrentUser } from "@/lib/auth";
import { discardPhotos } from "@/lib/handwritten";
import { db } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { paths?: unknown } | null;
  const paths = Array.isArray(body?.paths) ? body.paths.filter((p): p is string => typeof p === "string") : [];
  const removed = await discardPhotos(db, user.id, paths);
  return Response.json({ removed });
}
