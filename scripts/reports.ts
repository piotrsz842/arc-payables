/**
 * Review reported study-guide sections (a stand-in for a moderator screen).
 *
 *   npm run reports                     open reports
 *   npm run reports -- uphold <id>      the report is right: section stays off sale
 *   npm run reports -- dismiss <id>     the report is wrong: section goes back on sale (if no other open report)
 */
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "../lib/circle.js";
import { reviewReport } from "../lib/integrity.js";

const db = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false },
});
const [command, id] = process.argv.slice(2);
if (command === "uphold" || command === "dismiss") {
  await reviewReport(db, Number(id), command === "uphold" ? "upheld" : "dismissed");
  console.log(`Report ${id} ${command === "uphold" ? "upheld" : "dismissed"}.`);
} else {
  const { data } = await db
    .from("snippet_reports")
    .select("id, reason, details, created_at, snippets(id, title, course, flagged_at)")
    .eq("status", "open")
    .order("created_at");
  if (!data?.length) console.log("No open reports.");
  for (const r of data ?? []) {
    const s = r.snippets as unknown as { id: string; title: string; course: string; flagged_at: string | null };
    console.log(`#${r.id}  ${r.reason}  [${s.course}] "${s.title}" (${s.id})${s.flagged_at ? "  OFF SALE" : ""}${r.details ? `\n      "${r.details}"` : ""}`);
  }
}
