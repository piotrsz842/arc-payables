/**
 * Content integrity: reports and answer ratings.
 *
 * REPORTS: anyone signed in can report a study-guide section. One report is
 * enough to FLAG it: a flagged section stops being sold at once (search and
 * the paid x402 endpoint skip it) until a person reviews the report.
 * Review is a script for now (`npm run reports`): "dismiss" puts it back on
 * sale (if no other report is open), "uphold" keeps it off.
 *
 * RATINGS: thumbs up / down on a tutor answer. An author's score is the sum
 * of ratings on answers that used their sections. Search uses it only as a
 * tie-breaker between equally relevant sections.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { priceSection, wordCount } from "./pricing";

export const REPORT_REASONS = {
  copies_course_materials: "Copies course materials (slides, handouts, lecture text)",
  instructor_removal_request: "I'm the instructor and want this removed",
  ai_generated: "Looks like AI output, not a student's own work",
  wrong_or_misleading: "Wrong or misleading",
  other: "Something else",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;
export const isReportReason = (r: string): r is ReportReason => r in REPORT_REASONS;

export async function reportSnippet(
  db: SupabaseClient,
  report: { snippetId: string; reporterId: string; reason: ReportReason; details?: string },
) {
  const { error } = await db.from("snippet_reports").insert({
    snippet_id: report.snippetId,
    reporter_id: report.reporterId,
    reason: report.reason,
    details: report.details?.slice(0, 1000) || null,
  });
  if (error) throw new Error(`Could not save report: ${error.message}`);
  // Stop selling it now; keep the first flag time if it was already flagged.
  await db.from("snippets").update({ flagged_at: new Date().toISOString() }).eq("id", report.snippetId).is("flagged_at", null);
}

/** A person reviewed a report. Dismissing the last open report puts the section back on sale. */
export async function reviewReport(db: SupabaseClient, reportId: number, outcome: "upheld" | "dismissed") {
  const { data: report, error } = await db
    .from("snippet_reports")
    .update({ status: outcome })
    .eq("id", reportId)
    .select("snippet_id")
    .single();
  if (error || !report) throw new Error(`No report ${reportId}`);
  if (outcome === "dismissed") {
    const { count } = await db
      .from("snippet_reports")
      .select("id", { count: "exact", head: true })
      .eq("snippet_id", report.snippet_id)
      .neq("status", "dismissed");
    // Back on sale only if nothing else keeps it off (another report, or the author deleted the guide).
    const { data: s } = await db.from("snippets").select("notes(deleted_at)").eq("id", report.snippet_id).single();
    const deleted = (s?.notes as unknown as { deleted_at: string | null } | null)?.deleted_at;
    if (!count && !deleted) await db.from("snippets").update({ flagged_at: null }).eq("id", report.snippet_id);
  }
}

/**
 * The author deletes their own study guide. SOFT delete: it's taken off sale
 * with the same flag reports use (search, the tutor and the x402 endpoint all
 * skip it), but rows stay, so past sales, earnings and cash-outs are intact.
 * Content an agent already bought can't be taken back; it just can't be sold again.
 */
export async function deleteStudyGuide(db: SupabaseClient, authorId: string, noteId: string): Promise<boolean> {
  const now = new Date().toISOString();
  const { data } = await db
    .from("notes")
    .update({ deleted_at: now })
    .eq("id", noteId)
    .eq("author_id", authorId) // only your own
    .is("deleted_at", null)
    .select("id");
  if (!data?.length) return false;
  await db.from("snippets").update({ flagged_at: now }).eq("note_id", noteId).is("flagged_at", null);
  return true;
}

/** Save the asker's thumbs up (1) or down (-1) for their answer. */
export async function rateAnswer(db: SupabaseClient, userId: string, runId: string, rating: 1 | -1): Promise<boolean> {
  const { data: run } = await db.from("agent_runs").select("asked_by, status").eq("id", runId).single();
  if (!run || run.asked_by !== userId || run.status === "running") return false;
  const { error } = await db.from("answer_ratings").upsert({ run_id: runId, user_id: userId, rating });
  if (error) return false;
  // Ratings move prices: re-price every author whose sections this answer used.
  const { data: used } = await db.from("purchase_decisions").select("snippet_id").eq("run_id", runId).eq("paid", true);
  const ids = (used ?? []).map((u) => u.snippet_id);
  const { data: authors } = ids.length ? await db.from("snippets").select("author_id").in("id", ids) : { data: [] };
  for (const a of new Set((authors ?? []).map((x) => x.author_id as string))) await repriceAuthor(db, a);
  return true;
}

/** Set every section of one author to its current formula price (length × the author's rating). */
export async function repriceAuthor(db: SupabaseClient, authorId: string) {
  const rating = (await authorRatings(db)).get(authorId);
  const { data: sections } = await db.from("snippets").select("id, content, price_usd").eq("author_id", authorId);
  for (const s of sections ?? []) {
    const price = priceSection(wordCount(s.content), rating).usd;
    if (Number(price) !== Number(s.price_usd)) await db.from("snippets").update({ price_usd: price }).eq("id", s.id);
  }
}

/** Author → { up, down } from ratings on answers that used their sections. */
export async function authorRatings(db: SupabaseClient): Promise<Map<string, { up: number; down: number }>> {
  const scores = new Map<string, { up: number; down: number }>();
  const { data: ratings } = await db.from("answer_ratings").select("run_id, rating");
  if (!ratings?.length) return scores;
  // The decision log stores snippet ids (no foreign key), so look the authors up separately.
  const { data: used } = await db
    .from("purchase_decisions")
    .select("run_id, snippet_id")
    .eq("paid", true)
    .in("run_id", ratings.map((r) => r.run_id));
  const ids = [...new Set((used ?? []).map((u) => u.snippet_id))];
  const { data: snippets } = ids.length ? await db.from("snippets").select("id, author_id").in("id", ids) : { data: [] };
  const authorOf = new Map((snippets ?? []).map((s) => [s.id, s.author_id as string]));
  const ratingOf = new Map(ratings.map((r) => [r.run_id, r.rating as number]));
  const counted = new Set<string>(); // one vote per author per answer
  for (const u of used ?? []) {
    const author = authorOf.get(u.snippet_id);
    const key = `${u.run_id}:${author}`;
    if (!author || counted.has(key)) continue;
    counted.add(key);
    const s = scores.get(author) ?? { up: 0, down: 0 };
    if (ratingOf.get(u.run_id) === 1) s.up++;
    else s.down++;
    scores.set(author, s);
  }
  return scores;
}
