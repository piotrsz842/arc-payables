/**
 * Reading snippets from the database: free previews (search) and the paid
 * content (only for the x402 endpoint, after payment).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { authorRatings } from "./integrity";
import { normalizeCourse } from "./notes";

export type SnippetPreview = {
  id: string;
  title: string;
  course: string;
  summary: string;
  priceUsd: string;
  authorId: string;
};

const PREVIEW_COLUMNS = "id, title, course, summary, price_usd, author_id";

type PreviewRow = { id: string; title: string; course: string; summary: string; price_usd: number | string; author_id: string };
const toPreview = (r: PreviewRow): SnippetPreview => ({
  id: r.id,
  title: r.title,
  course: r.course,
  summary: r.summary,
  priceUsd: String(r.price_usd),
  authorId: r.author_id,
});

/**
 * Find previews for a question. Simple keyword scoring over title + summary
 * (plenty for a hackathon-sized library; a real one would use full-text or
 * vector search). Never returns content. Reported (flagged) sections are
 * not for sale, so they never show up. Equally relevant sections are ordered
 * by their author's answer ratings.
 */
export async function searchPreviews(
  db: SupabaseClient,
  opts: { query?: string; course?: string; excludeAuthorId?: string; limit?: number } = {},
): Promise<SnippetPreview[]> {
  let q = db.from("snippets").select(PREVIEW_COLUMNS).is("flagged_at", null).limit(500);
  if (opts.course) q = q.eq("course", normalizeCourse(opts.course));
  if (opts.excludeAuthorId) q = q.neq("author_id", opts.excludeAuthorId); // never sell you your own notes
  const { data, error } = await q;
  if (error) throw new Error(`Could not search snippets: ${error.message}`);

  const words = (opts.query ?? "").toLowerCase().match(/[a-z0-9^]{3,}/g) ?? [];
  const ratings = await authorRatings(db);
  const rating = (authorId: string) => {
    const r = ratings.get(authorId);
    return r ? r.up - r.down : 0;
  };
  const scored = data.map((row) => {
    const text = `${row.title} ${row.summary}`.toLowerCase();
    return { row, score: words.filter((w) => text.includes(w)).length, rating: rating(row.author_id) };
  });
  return scored
    .filter((s) => words.length === 0 || s.score > 0)
    .sort((a, b) => b.score - a.score || b.rating - a.rating) // relevance first, ratings break ties
    .slice(0, opts.limit ?? 8)
    .map((s) => toPreview(s.row));
}

export async function getPreview(db: SupabaseClient, id: string): Promise<SnippetPreview | null> {
  // A flagged section is not for sale: treat it as not found.
  const { data } = await db.from("snippets").select(PREVIEW_COLUMNS).eq("id", id).is("flagged_at", null).maybeSingle();
  return data ? toPreview(data) : null;
}

/** The full snippet, content included. Only the paid endpoint should call this. */
export async function getSnippetWithContent(db: SupabaseClient, id: string) {
  const { data } = await db.from("snippets").select(`${PREVIEW_COLUMNS}, content`).eq("id", id).is("flagged_at", null).maybeSingle();
  return data ? { ...toPreview(data), content: data.content as string } : null;
}
