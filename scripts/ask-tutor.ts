/**
 * Ask the real tutor agent a question from the terminal, as a demo user.
 * Same code path as the web page (lib/tutor.ts).
 *
 * Run (with `npm run dev` running):
 *   npm run ask -- "CPSC 221: why is quicksort O(n^2) in the worst case?"
 *   npm run ask -- "..." --as=sam@example.com --human=yes|no|pending
 */
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "../lib/circle.js";
import { toUsd, totalsFor } from "../lib/ledger.js";
import type { HumanAnswer } from "../lib/purchases.js";
import { askTutor, getRunReceipt } from "../lib/tutor.js";

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const question = args.filter((a) => !a.startsWith("--")).join(" ");
if (!question) throw new Error('Usage: npm run ask -- "your question" [--as=email] [--human=yes|no|pending]');
const email = flag("as") ?? "sam@example.com";
const human = (flag("human") ?? "pending") as "yes" | "no" | "pending";

const db = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false },
});
const { data: profile } = await db.from("profiles").select("*").eq("email", email).single();
if (!profile) throw new Error(`No profile for ${email}: run npm run seed`);

const before = await totalsFor(db, profile.id);
console.log(`Asking as ${profile.display_name} (balance $${toUsd(before.balance)}, ${profile.free_questions_left} free questions left)`);
console.log(`Q: ${question}\n`);

const { runId, answer } = await askTutor({
  db,
  baseUrl: process.env.BASE_URL ?? "http://localhost:3000",
  user: { id: profile.id, freeQuestionsLeft: profile.free_questions_left },
  question,
  askHuman: async (preview, decision): Promise<HumanAnswer> => {
    console.log(`  ? approval needed for "${preview.title}": ${decision.reason} → ${human}`);
    return human === "yes" ? "approved" : human === "no" ? "denied" : "pending";
  },
});

console.log(`A: ${answer}\n`);
const { run, decisions } = await getRunReceipt(db, runId);
for (const d of decisions) {
  const mark = d.paid ? "✓ bought" : d.verdict === "block" ? "✗ blocked" : `? ${d.human_decision ?? "waiting"}`;
  console.log(`${mark}  "${d.title}" by ${d.authorName ?? "?"} $${d.price_usd} [${d.rule}]`);
  console.log(`     agent: ${d.agent_reason}`);
  if (!d.paid) console.log(`     checker: ${d.checker_reason}`);
}
const after = await totalsFor(db, profile.id);
console.log(`\nSpent on notes $${run.spent_usd}; ${run.free_question ? "free question" : `charged $${run.charged_usd}`}.`);
console.log(`Balance $${toUsd(before.balance)} → $${toUsd(after.balance)}. Run ${runId} (${run.status}).`);
