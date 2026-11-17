/**
 * One proposed purchase, start to finish:
 *
 *   agent proposes (snippet + reason)
 *     → read this question's history from the DECISION LOG (not from the agent)
 *     → checker decides allow / block / ask_human
 *     → decision written to the log (always, before any money moves)
 *     → if ask_human: a person approves or denies (also logged)
 *     → if allowed: pay over x402 from the agent's Gateway balance, log the payment
 *
 * The database is the source of truth for history, so the agent can't
 * "forget" what it already bought or what was blocked.
 *
 * Works with any Supabase client using the SECRET key (server or script).
 */
import type { GatewayClient } from "@circle-fin/x402-batching/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatUnits, parseUnits } from "viem";
import { checkPurchase, type Decision } from "./checker";
import type { SnippetPreview } from "./demo-snippets";

export type Run = { id: string; question: string; budget_usd: number };

export type Outcome = {
  decision: Decision;
  humanDecision?: "approved" | "denied";
  paid: boolean;
  content?: string;
  transferId?: string;
};

/** Ask a person: "should the agent buy this?" Returns true to approve. */
export type AskHuman = (preview: SnippetPreview, decision: Decision) => Promise<boolean>;

const micro = (amount: string | number) => parseUnits(String(amount), 6);
const dollars = (amount: bigint) => formatUnits(amount, 6);

export async function startRun(db: SupabaseClient, question: string, budgetUsd: string): Promise<Run> {
  const { data, error } = await db.from("agent_runs").insert({ question, budget_usd: budgetUsd }).select().single();
  if (error) throw new Error(`Could not start run: ${error.message}`);
  return data;
}

export async function finishRun(db: SupabaseClient, runId: string, status: "finished" | "stopped_looping") {
  const { error } = await db.from("agent_runs").update({ status }).eq("id", runId);
  if (error) throw new Error(`Could not finish run: ${error.message}`);
}

export async function proposePurchase(opts: {
  db: SupabaseClient;
  agent: GatewayClient;
  baseUrl: string;
  run: Run;
  preview: SnippetPreview;
  reason: string;
  askHuman: AskHuman;
}): Promise<Outcome> {
  const { db, agent, run, preview, reason } = opts;

  // 1. History of this question, from the log.
  const { data: rows, error: readError } = await db
    .from("purchase_decisions")
    .select("snippet_id, verdict, human_decision, paid, price_usd")
    .eq("run_id", run.id);
  if (readError) throw new Error(`Could not read decision log: ${readError.message}`);

  const spent = rows.filter((r) => r.paid).reduce((sum, r) => sum + micro(r.price_usd), 0n);
  const remaining = micro(run.budget_usd) - spent;
  const balances = await agent.getBalances(); // the agent's Gateway balance = its real money

  // 2. The checker. Note what it gets: question, preview, reason, budget. Nothing else.
  const decision = await checkPurchase(
    preview.id,
    {
      question: run.question,
      preview: { title: preview.title, course: preview.course, summary: preview.summary },
      reason,
      priceUsd: preview.priceUsd,
      budget: { remainingUsd: dollars(remaining), gatewayAvailableUsd: balances.gateway.formattedAvailable },
    },
    {
      proposedCount: rows.length,
      boughtIds: rows.filter((r) => r.paid).map((r) => r.snippet_id),
      blockedIds: rows.filter((r) => r.verdict === "block" || r.human_decision === "denied").map((r) => r.snippet_id),
    },
  );

  // 3. Log the decision BEFORE any money moves.
  const { data: logged, error: logError } = await db
    .from("purchase_decisions")
    .insert({
      run_id: run.id,
      snippet_id: preview.id,
      price_usd: preview.priceUsd,
      agent_reason: reason,
      verdict: decision.verdict,
      rule: decision.rule,
      checker_reason: decision.reason,
      relevance: decision.relevance ?? null,
    })
    .select("id")
    .single();
  if (logError) throw new Error(`Could not log decision: ${logError.message}`);
  const logId = logged.id;

  // 4. A human decides the unclear cases.
  let humanDecision: Outcome["humanDecision"];
  if (decision.verdict === "ask_human") {
    humanDecision = (await opts.askHuman(preview, decision)) ? "approved" : "denied";
    await db.from("purchase_decisions").update({ human_decision: humanDecision }).eq("id", logId);
  }

  const mayPay = decision.verdict === "allow" || humanDecision === "approved";
  if (!mayPay) return { decision, humanDecision, paid: false };

  // 5. Pay over x402 (Gateway Nanopayments) and record it.
  const result = await agent.pay<{ content: string }>(`${opts.baseUrl}/api/snippets/${preview.id}`);
  await db.from("purchase_decisions").update({ paid: true, gateway_transfer_id: result.transaction }).eq("id", logId);
  await db.from("agent_runs").update({ spent_usd: dollars(spent + micro(preview.priceUsd)) }).eq("id", run.id);

  return { decision, humanDecision, paid: true, content: result.data.content, transferId: result.transaction };
}
