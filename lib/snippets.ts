/**
 * Reading snippets from the database: free previews (search) and the paid
 * content (only for the x402 endpoint, after payment).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { embed, embeddingsEnabled, toVector } from "./embeddings";
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
 * Find previews for a question. HYBRID search, course first:
 *   - meaning: pgvector cosine similarity between the question and each
 *     section (Voyage embeddings), filtered to the course in Postgres
 *   - keywords: how many of the question's words appear in title + preview
 *   score = similarity + 0.05 per keyword hit; ratings break ties.
 * Without embeddings (no key / not set up) it's keyword-only, as before.
 * Never returns content. Reported (flagged) sections are not for sale, so
 * they never show up.
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
  const similarity = opts.query ? await meaningScores(db, opts.query, opts.course, opts.excludeAuthorId) : null;
  const ratings = await authorRatings(db);
  const rating = (authorId: string) => {
    const r = ratings.get(authorId);
    return r ? r.up - r.down : 0;
  };
  const scored = data.map((row) => {
    const text = `${row.title} ${row.summary}`.toLowerCase();
    const hits = words.filter((w) => text.includes(w)).length;
    const sim = similarity?.get(row.id);
    return {
      row,
      // keep: any keyword hit, or close enough in meaning
      keep: words.length === 0 || hits > 0 || (sim !== undefined && sim >= MIN_SIMILARITY),
      score: similarity ? (sim ?? 0) + 0.05 * hits : hits,
      rating: rating(row.author_id),
    };
  });
  return scored
    .filter((s) => s.keep)
    .sort((a, b) => b.score - a.score || b.rating - a.rating) // relevance first, ratings break ties
    .slice(0, opts.limit ?? 8)
    .map((s) => toPreview(s.row));
}

// Below this cosine similarity a section isn't considered a match by meaning alone.
const MIN_SIMILARITY = 0.35;

/** id → similarity for the closest sections (pgvector), or null if meaning search isn't available. */
async function meaningScores(db: SupabaseClient, query: string, course?: string, excludeAuthorId?: string) {
  if (!embeddingsEnabled()) return null;
  try {
    const [v] = await embed([query], "query");
    const { data, error } = await db.rpc("match_snippets", {
      query_embedding: toVector(v),
      match_course: course ? normalizeCourse(course) : null,
      exclude_author: excludeAuthorId ?? null,
      match_count: 30,
    });
    if (error) throw new Error(error.message);
    return new Map(((data ?? []) as { id: string; similarity: number }[]).map((r) => [r.id, r.similarity]));
  } catch (err) {
    console.error("Meaning search unavailable, using keywords only:", err);
    return null;
  }
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
