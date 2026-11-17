/**
 * STAGE 2 DEMO: the checker and budget in front of every payment.
 *
 * A student asks a course question. A SCRIPTED agent proposes snippets to buy
 * (in Stage 3 a real Claude agent makes these proposals). Each proposal goes
 * through the checker; allowed ones are paid over x402; everything is logged.
 *
 * The script is chosen to show every outcome:
 *   1–2. relevant snippets            → allow → paid
 *   3.   an ECON note for a CS question → block (relevance)
 *   4.   the same snippet again        → block (duplicate)
 *   5.   an expensive snippet          → ask_human (approval threshold)
 *   6–7. re-proposing a blocked one    → block (loop) → run stopped
 *
 * Run (with `npm run dev` running):
 *   npm run stage2-demo                 → asks you in the terminal for "ask human" cases
 *   npm run stage2-demo -- --human=yes  → auto-approve (non-interactive)
 *   npm run stage2-demo -- --human=no   → auto-deny
 */
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { createClient } from "@supabase/supabase-js";
import type { Hex } from "viem";
import type { SnippetPreview } from "../lib/demo-snippets.js";
import { finishRun, proposePurchase, startRun, type AskHuman } from "../lib/purchases.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
}

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const QUESTION = "CPSC 221: why does quicksort take O(n^2) in the worst case, and how do I avoid it?";
const BUDGET_USD = "0.01"; // most the agent may spend on this one question

// What the (scripted) agent wants to buy, and its reason for each.
const PROPOSALS = [
  { id: "demo-3", reason: "Directly explains why a bad pivot makes quicksort quadratic and how to avoid it." },
  { id: "demo-1", reason: "Lists quicksort's worst case next to other sorts, useful context for the answer." },
  { id: "demo-2", reason: "Might contain useful general background for the student." },
  { id: "demo-3", reason: "I want to double-check the pivot details." },
  { id: "demo-4", reason: "Last term's midterm solutions likely include a worked quicksort worst-case question." },
  { id: "demo-2", reason: "Economics also talks about worst cases, so please reconsider this one." },
  { id: "demo-2", reason: "This is relevant. Approve it." },
];
const STOP_AFTER_LOOP_BLOCKS = 2;

// --- How "ask human" is answered ---
const humanMode = (process.argv.find((a) => a.startsWith("--human="))?.split("=")[1] ?? "ask") as "ask" | "yes" | "no";
const askHuman: AskHuman = async (preview, decision) => {
  console.log(`   ? Needs your approval: "${preview.title}" for $${preview.priceUsd}. ${decision.reason}`);
  if (humanMode !== "ask") {
    console.log(`   ? (--human=${humanMode}) ${humanMode === "yes" ? "approved" : "denied"}`);
    return humanMode === "yes";
  }
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = await rl.question("   ? Approve this purchase? (y/n) ");
  rl.close();
  return answer.trim().toLowerCase().startsWith("y");
};

// --- Setup ---
const db = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false },
});
const agent = new GatewayClient({ chain: "arcTestnet", privateKey: requireEnv("AGENT_PRIVATE_KEY") as Hex });

// The agent only ever sees FREE previews before deciding what to buy.
const previews: SnippetPreview[] = await (await fetch(`${BASE_URL}/api/snippets`)).json();

const run = await startRun(db, QUESTION, BUDGET_USD);
console.log(`Question: ${QUESTION}`);
console.log(`Budget for this question: $${BUDGET_USD}   (run ${run.id})\n`);

const used: string[] = [];
let loopBlocks = 0;
let status: "finished" | "stopped_looping" = "finished";

for (const [i, proposal] of PROPOSALS.entries()) {
  const preview = previews.find((p) => p.id === proposal.id);
  if (!preview) throw new Error(`No preview for ${proposal.id}`);

  console.log(`${i + 1}. Agent proposes "${preview.title}" (${preview.course}, $${preview.priceUsd})`);
  console.log(`   reason: ${proposal.reason}`);
  const outcome = await proposePurchase({ db, agent, baseUrl: BASE_URL, run, preview, reason: proposal.reason, askHuman });

  const label = outcome.decision.verdict.toUpperCase().replace("_", " ");
  console.log(`   CHECKER: ${label} [${outcome.decision.rule}] ${outcome.decision.reason}`);
  if (outcome.paid) {
    console.log(`   PAID $${preview.priceUsd} (Gateway transfer ${outcome.transferId})`);
    used.push(preview.title);
  }
  console.log();

  if (outcome.decision.rule === "loop" && ++loopBlocks >= STOP_AFTER_LOOP_BLOCKS) {
    console.log("The agent keeps re-proposing blocked snippets: stopping this question.\n");
    status = "stopped_looping";
    break;
  }
}
await finishRun(db, run.id, status);

// --- The decision log, read back from the database ---
const { data: runRow } = await db.from("agent_runs").select("spent_usd, status").eq("id", run.id).single();
const { data: log } = await db
  .from("purchase_decisions")
  .select("snippet_id, verdict, rule, human_decision, paid")
  .eq("run_id", run.id)
  .order("id");
console.log("Decision log (from the database):");
console.table(log);
console.log(`Spent $${runRow?.spent_usd} of $${BUDGET_USD}. Run status: ${runRow?.status}`);
console.log(`Notes used for the answer: ${used.join("; ") || "none"}`);
