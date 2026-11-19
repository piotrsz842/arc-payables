/**
 * Make a study set. POST { course, topic, kind: "quiz" | "flashcards", count } → StudySet JSON.
 */
import { getCurrentUser } from "@/lib/auth";
import { siteUrl } from "@/lib/site-url";
import { createStudySet, NothingToStudyError } from "@/lib/study";
import { db } from "@/lib/supabase/admin";
import { NeedsTopUpError } from "@/lib/tutor";

export const maxDuration = 300;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { course?: string; topic?: string; kind?: string; count?: number } | null;
  const kind = body?.kind === "flashcards" ? "flashcards" : "quiz";
  const topic = String(body?.topic ?? "").trim();
  if (!topic) return Response.json({ error: "Pick a topic first." }, { status: 400 });
  try {
    const set = await createStudySet({
      db,
      baseUrl: await siteUrl(),
      user,
      course: String(body?.course ?? ""),
      topic,
      kind,
      count: Number(body?.count) || (kind === "quiz" ? 5 : 8),
    });
    return Response.json(set);
  } catch (err) {
    if (err instanceof NeedsTopUpError) return Response.json({ error: "topup" }, { status: 402 });
    if (err instanceof NothingToStudyError) return Response.json({ error: err.message }, { status: 404 });
    console.error("Study set failed:", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
