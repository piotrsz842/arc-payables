/**
 * The money ledger: every dollar movement for a person is one row in
 * ledger_entries. A person's numbers are just sums over their rows:
 *
 *   balance   = everything added up (what they can spend or cash out)
 *   earnings  = sum of 'sale' rows (what their notes have earned, ever)
 *
 * "Your notes pay for your tutoring": a question's cost comes out of the
 * same balance that earnings go into.
 *
 * Amounts are handled as micro-dollars (bigint) to avoid rounding errors.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatUnits, parseUnits } from "viem";

export const toMicro = (usd: string | number) => parseUnits(String(usd), 6);
export const toUsd = (micro: bigint) => formatUnits(micro, 6);

export type Totals = { balance: bigint; earnings: bigint; spent: bigint; toppedUp: bigint; paidOut: bigint };

export async function totalsFor(db: SupabaseClient, userId: string): Promise<Totals> {
  const { data, error } = await db.from("ledger_entries").select("kind, amount_usd").eq("user_id", userId);
  if (error) throw new Error(`Could not read ledger: ${error.message}`);
  const t: Totals = { balance: 0n, earnings: 0n, spent: 0n, toppedUp: 0n, paidOut: 0n };
  for (const row of data) {
    const amount = toMicro(row.amount_usd);
    t.balance += amount;
    if (row.kind === "sale") t.earnings += amount;
    if (row.kind === "spend") t.spent -= amount; // stored negative, reported positive
    if (row.kind === "topup") t.toppedUp += amount;
    if (row.kind === "payout") t.paidOut -= amount;
  }
  return t;
}

/**
 * Credit an author for a sale. Called by the SELLER endpoint the moment
 * Circle Gateway accepts the payment, so earnings rise immediately.
 * The unique gateway_transfer_id makes this safe to call twice.
 */
export async function recordSale(
  db: SupabaseClient,
  sale: { authorId: string; snippetId: string; priceUsd: string; gatewayTransferId: string; payer: string },
) {
  const { error } = await db.from("ledger_entries").insert({
    user_id: sale.authorId,
    kind: "sale",
    amount_usd: sale.priceUsd,
    snippet_id: sale.snippetId,
    gateway_transfer_id: sale.gatewayTransferId,
    detail: { payer: sale.payer },
  });
  // 23505 = unique violation = this payment was already credited. Fine.
  if (error && error.code !== "23505") throw new Error(`Could not record sale: ${error.message}`);
}

export async function recordEntry(
  db: SupabaseClient,
  entry: { userId: string; kind: "spend" | "topup" | "payout"; amountUsd: string; runId?: string; detail?: object },
) {
  const { error } = await db.from("ledger_entries").insert({
    user_id: entry.userId,
    kind: entry.kind,
    amount_usd: entry.amountUsd,
    run_id: entry.runId ?? null,
    detail: entry.detail ?? null,
  });
  if (error) throw new Error(`Could not record ${entry.kind}: ${error.message}`);
}
