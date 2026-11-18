/**
 * Thumbs up / down on a tutor answer. POST { runId, rating: 1 | -1 }.
 * Only the person who asked, only after the answer is finished.
 */
import { getCurrentUser } from "@/lib/auth";
import { rateAnswer } from "@/lib/integrity";
import { db } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { runId?: string; rating?: number } | null;
  if (!body?.runId || (body.rating !== 1 && body.rating !== -1)) return Response.json({ error: "Bad rating." }, { status: 400 });
  const ok = await rateAnswer(db, user.id, body.runId, body.rating);
  return ok ? Response.json({ ok: true }) : Response.json({ error: "Can't rate this answer." }, { status: 409 });
}
