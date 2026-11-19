/**
 * Remove handwritten-page photos that never became part of a study guide
 * (the author closed the tab before the page could tell us, or the browser
 * dropped the beacon). Only photos older than a day, so uploads in progress
 * are safe.
 *
 *   npm run cleanup-photos             list what would be removed
 *   npm run cleanup-photos -- --yes    remove them
 */
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "../lib/circle.js";

const BUCKET = "handwritten";
const db = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false },
});
const remove = process.argv.includes("--yes");
const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

const { data: notes, error } = await db.from("notes").select("image_paths").not("image_paths", "is", null);
if (error) throw error;
const used = new Set((notes ?? []).flatMap((n) => (n.image_paths as string[] | null) ?? []));

const { data: folders } = await db.storage.from(BUCKET).list("", { limit: 1000 });
const orphans: string[] = [];
for (const folder of folders ?? []) {
  const { data: files } = await db.storage.from(BUCKET).list(folder.name, { limit: 1000 });
  for (const f of files ?? []) {
    const path = `${folder.name}/${f.name}`;
    const created = f.created_at ? Date.parse(f.created_at) : 0;
    if (!used.has(path) && created < dayAgo) orphans.push(path);
  }
}
console.log(`${used.size} photos belong to study guides; ${orphans.length} unused photos older than a day.`);
if (orphans.length && remove) {
  const { error: rmError } = await db.storage.from(BUCKET).remove(orphans);
  if (rmError) throw rmError;
  console.log(`Removed ${orphans.length}.`);
} else if (orphans.length) {
  console.log("Run with -- --yes to remove them.");
}
