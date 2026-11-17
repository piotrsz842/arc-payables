/**
 * GET /api/snippets?q=quicksort&course=CPSC%20221 → FREE previews (title,
 * course, one-line summary, price). Never the content: that is what the
 * agent pays for at /api/snippets/:id.
 */
import { NextResponse, type NextRequest } from "next/server";
import { searchPreviews } from "@/lib/snippets";
import { db } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const previews = await searchPreviews(db, {
    query: params.get("q") ?? undefined,
    course: params.get("course") ?? undefined,
    limit: 50,
  });
  // authorId stays server-side: previews are public.
  return NextResponse.json(previews.map(({ authorId: _authorId, ...p }) => p));
}
