/**
 * One proposed purchase, start to finish:
 *
 *   agent proposes (snippet + reason)
 *     → read this question's history from the DECISION LOG (not from the agent)
 *     → checker decides allow / block / ask_human
 *     → decision written to the log (always, before any money moves)
 *     → if ask_human: a person approves, denies, or it waits ("pending")
 *     → if allowed: pay over x402 from the agent's Gateway balance
 *
 * The database is the source of truth for history, so the agent can't
 * "forget" what it already bought or what was blocked.
 */
import type { GatewayClient } from "@circle-fin/x402-batching/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkPurchase, type Decision, type QuestionJudge } from "./checker";
import { toMicro, toUsd } from "./ledger";
import type { SnippetPreview } from "./snippets";
import type { UsageMeter } from "./usage";

export type Run = { id: string; question: string; budget_usd: number };

export type HumanAnswer = "approved" | "denied" | "pending";
/**
 * Ask a person: "should the agent buy this?" `logId` is the decision's row in
 * the log, so a web page can answer it. "pending" = no answer (yet).
 */
export type AskHuman = (preview: SnippetPreview, decision: Decision, logId: number) => Promise<HumanAnswer>;

export type Outcome = {
  logId: number;
  decision: Decision;
  humanDecision?: HumanAnswer;
  paid: boolean;
  content?: string;
  transferId?: string;
};

export async function startRun(
  db: SupabaseClient,
  run: { question: string; budgetUsd: string; askedBy?: string; freeQuestion?: boolean },
): Promise<Run> {
  const { data, error } = await db
    .from("agent_runs")
    .insert({
      question: run.question,
      budget_usd: run.budgetUsd,
      asked_by: run.askedBy ?? null,
      free_question: run.freeQuestion ?? false,
    })
    .select()
    .single();
  if (error) throw new Error(`Could not start run: ${error.message}`);
  return data;
}

export async function finishRun(
  db: SupabaseClient,
  runId: string,
  update: { status: "finished" | "stopped_looping"; answer?: string; chargedUsd?: string },
) {
  const { error } = await db
    .from("agent_runs")
    .update({ status: update.status, answer: update.answer ?? null, charged_usd: update.chargedUsd ?? 0 })
    .eq("id", runId);
  if (error) throw new Error(`Could not finish run: ${error.message}`);
}

/** Total paid for snippets in this run, from the log. */
export async function spentInRun(db: SupabaseClient, runId: string): Promise<bigint> {
  const { data, error } = await db.from("purchase_decisions").select("price_usd").eq("run_id", runId).eq("paid", true);
  if (error) throw new Error(`Could not read decision log: ${error.message}`);
  return data.reduce((sum, r) => sum + toMicro(r.price_usd), 0n);
}

export async function proposePurchase(opts: {
  db: SupabaseClient;
  agent: GatewayClient;
  baseUrl: string;
  run: Run;
  preview: SnippetPreview;
  reason: string;
  askHuman: AskHuman;
  meter?: UsageMeter;
  judge?: QuestionJudge; // shared per question: one judge call covers all candidates
}): Promise<Outcome> {
  const { db, agent, run, preview, reason } = opts;

  // Steps 1-3 run one at a time per question: the model can ask for two
  // snippets at once, and both must not see "nothing spent yet".
  const { decision, logId } = await oneAtATime(run.id, async () => {
    // 1. History of this question, from the log.
    const { data: rows, error: readError } = await db
      .from("purchase_decisions")
      .select("snippet_id, verdict, human_decision, paid, price_usd")
      .eq("run_id", run.id);
    if (readError) throw new Error(`Could not read decision log: ${readError.message}`);

    // Money already promised: paid, allowed but still paying, or waiting for
    // (or approved by) a person. Counting it keeps parallel requests honest.
    const promised = rows.filter(
      (r) => r.paid || r.verdict === "allow" || (r.verdict === "ask_human" && r.human_decision !== "denied"),
    );
    const committed = promised.reduce((sum, r) => sum + toMicro(r.price_usd), 0n);
    const remaining = toMicro(run.budget_usd) - committed;
    const balances = await agent.getBalances(); // the agent's Gateway balance = its real money

    // 2. The checker. Note what it gets: question, preview, reason, budget. Nothing else.
    const decision = await checkPurchase(
      preview.id,
      {
        question: run.question,
        preview: { title: preview.title, course: preview.course, summary: preview.summary },
        reason,
        priceUsd: preview.priceUsd,
        budget: { remainingUsd: toUsd(remaining), gatewayAvailableUsd: balances.gateway.formattedAvailable },
      },
      {
        proposedCount: rows.length,
        // Bought, or allowed and being paid right now: buying it again would be a duplicate.
        boughtIds: rows.filter((r) => r.paid || r.verdict === "allow").map((r) => r.snippet_id),
        // Blocked, denied, or still waiting for a human: proposing it again is looping.
        blockedIds: rows
          .filter((r) => r.verdict === "block" || (r.verdict === "ask_human" && r.human_decision !== "approved"))
          .map((r) => r.snippet_id),
      },
      { judge: opts.judge, meter: opts.meter },
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
    return { decision, logId: logged.id as number };
  });

  // 4. A human decides the unclear cases (or will decide later: "pending").
  //    Outside the one-at-a-time section, so other purchases can go ahead meanwhile.
  let humanDecision: HumanAnswer | undefined;
  if (decision.verdict === "ask_human") {
    humanDecision = await opts.askHuman(preview, decision, logId);
    if (humanDecision !== "pending") {
      await db.from("purchase_decisions").update({ human_decision: humanDecision }).eq("id", logId);
    }
  }

  const mayPay = decision.verdict === "allow" || humanDecision === "approved";
  if (!mayPay) return { logId, decision, humanDecision, paid: false };

  const bought = await payForLoggedDecision(opts, logId, preview);
  return { logId, decision, humanDecision, paid: true, ...bought };
}

/** Pay over x402 (Gateway Nanopayments) for a logged, allowed decision, and record it. */
export async function payForLoggedDecision(
  opts: { db: SupabaseClient; agent: GatewayClient; baseUrl: string; run: Run },
  logId: number,
  preview: SnippetPreview,
) {
  const { db, agent, run } = opts;
  const result = await agent.pay<{ content: string }>(`${opts.baseUrl}/api/snippets/${preview.id}`);
  await db.from("purchase_decisions").update({ paid: true, gateway_transfer_id: result.transaction }).eq("id", logId);
  await db.from("agent_runs").update({ spent_usd: toUsd(await spentInRun(db, run.id)) }).eq("id", run.id);
  return { content: result.data.content, transferId: result.transaction };
}

// One queue per question run (all of a run's purchases happen in this one server process).
const queues = new Map<string, Promise<unknown>>();
function oneAtATime<T>(runId: string, task: () => Promise<T>): Promise<T> {
  const next = (queues.get(runId) ?? Promise.resolve()).then(task, task);
  const tail = next.catch(() => {});
  queues.set(runId, tail);
  tail.then(() => {
    if (queues.get(runId) === tail) queues.delete(runId);
  });
  return next;
}
