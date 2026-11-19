/**
 * One-off fix: rewrite stored course codes in the normalized form
 * ("GGIS204" → "GGIS 204") so course-first search finds all of a course's guides.
 *
 *   npm run normalize-courses
 */
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "../lib/circle.js";

const normalizeCourse = (course: string) =>
  course.trim().replace(/\s+/g, " ").toUpperCase().replace(/([A-Z])(\d)/g, "$1 $2"); // same as lib/notes.ts

const db = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false },
});
for (const table of ["notes", "snippets"] as const) {
  const { data, error } = await db.from(table).select("id, course");
  if (error) throw error;
  for (const row of data ?? []) {
    const fixed = normalizeCourse(row.course);
    if (fixed === row.course) continue;
    const { error: e } = await db.from(table).update({ course: fixed }).eq("id", row.id);
    if (e) throw e;
    console.log(`${table} ${row.id}: "${row.course}" → "${fixed}"`);
  }
}
