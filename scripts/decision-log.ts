/**
 * Print the agent's decision log, and check the money adds up.
 *
 * Run: npm run decision-log            → latest question
 *      npm run decision-log -- all     → totals across every question
 */
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "../lib/circle.js";

const db = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false },
});

if (process.argv[2] === "all") {
  const { data, error } = await db.from("purchase_decisions").select("price_usd, paid, gateway_transfer_id");
  if (error) throw error;
  const paid = data.filter((r) => r.paid);
  const total = paid.reduce((sum, r) => sum + Number(r.price_usd), 0);
  console.log(`${data.length} proposals logged, ${paid.length} paid, total $${total.toFixed(6)}`);
  console.log(`Every paid row has a Gateway transfer id: ${paid.every((r) => r.gateway_transfer_id)}`);
} else {
  const { data: run, error } = await db.from("agent_runs").select("*").order("created_at", { ascending: false }).limit(1).single();
  if (error) throw error;
  console.log(`Question: ${run.question}`);
  console.log(`Spent $${run.spent_usd} of $${run.budget_usd}, status ${run.status}\n`);
  const { data: rows } = await db
    .from("purchase_decisions")
    .select("snippet_id, price_usd, verdict, rule, human_decision, paid, checker_reason")
    .eq("run_id", run.id)
    .order("id");
  for (const r of rows ?? []) {
    const human = r.human_decision ? ` → human ${r.human_decision}` : "";
    console.log(`${r.snippet_id}  $${r.price_usd}  ${r.verdict} [${r.rule}]${human}${r.paid ? "  PAID" : ""}`);
    console.log(`    ${r.checker_reason}`);
  }
}
