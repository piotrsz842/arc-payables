/**
 * Give meaning vectors to everything that doesn't have one yet: study-guide
 * sections (for search) and past tutor answers (for the near-duplicate check).
 * Safe to re-run. Needs VOYAGE_API_KEY and migration 005.
 *
 * Run: npm run embed-backfill
 */
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "../lib/circle.js";
import { embed, sectionText, toVector } from "../lib/embeddings.js";

const db = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false },
});
requireEnv("VOYAGE_API_KEY");

const { data: snippets, error } = await db.from("snippets").select("id, course, title, summary, content").is("embedding", null);
if (error) throw new Error(`${error.message} (has migration 005 been run?)`);
for (let i = 0; i < snippets.length; i += 50) {
  const batch = snippets.slice(i, i + 50);
  const vectors = await embed(batch.map(sectionText), "document");
  for (const [j, s] of batch.entries()) await db.from("snippets").update({ embedding: toVector(vectors[j]) }).eq("id", s.id);
}
console.log(`Sections embedded: ${snippets.length}`);

const { data: runs } = await db.from("agent_runs").select("id, answer").is("answer_embedding", null).not("answer", "is", null);
for (let i = 0; i < (runs ?? []).length; i += 50) {
  const batch = runs!.slice(i, i + 50);
  const vectors = await embed(batch.map((r) => r.answer as string), "document");
  for (const [j, r] of batch.entries()) await db.from("agent_runs").update({ answer_embedding: toVector(vectors[j]) }).eq("id", r.id);
}
console.log(`Answers embedded: ${runs?.length ?? 0}`);
