/**
 * Cash-out: move an author's balance from our ledger into real money they hold.
 *
 * Every cash-out has a payout ID (e.g. "PO-3f9a1c2b7d"). It is written ON
 * CHAIN through Arc's Memo contract, so anyone can match a payment on Arc to
 * our ledger row, without any name or email being public.
 *
 * Two destinations:
 *   "arc"          platform wallet → author's wallet on Arc, with the memo.
 *                  One transaction, the platform pays the (tiny) gas.
 *   "base_sepolia" the same Arc memo payment, THEN the author's wallet bridges
 *                  the money to Base Sepolia with CCTP (Circle's burn-and-mint
 *                  bridge) through App Kit. Circle's forwarder does the
 *                  Base Sepolia side, so nobody needs gas on Base Sepolia.
 *                  The author pays the transfer fees out of the amount.
 *
 * Ledger rules (append-only): the payout row (negative) is written BEFORE
 * any money moves, so the balance drops at once and two clicks can't spend
 * it twice. If the payment fails, a reversal row gives the money back.
 *
 * Docs:
 *   https://docs.arc.io/arc/tutorials/send-usdc-with-transaction-memo
 *   https://docs.arc.io/app-kit/quickstarts/bridge-tokens-across-blockchains
 *   @circle-fin/bridge-kit README "Forwarder Integration" (installed 1.17.2)
 */
import "server-only";
import { createCircleWalletsAdapter } from "@circle-fin/adapter-circle-wallets";
import { AppKit } from "@circle-fin/app-kit";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAddressEqual, type Address, type Hex } from "viem";
import { buildMemoTransferCall, MEMO_ADDRESS, payoutMemoId, readMemoPayment } from "@/lib/arc";
import { circle, requireEnv, waitForTransaction } from "@/lib/circle";
import { toMicro, totalsFor, toUsd } from "@/lib/ledger";

export const DESTINATIONS = {
  arc: { label: "Arc", minUsd: "0.01", explorer: "https://explorer.testnet.arc.io/tx/" },
  base_sepolia: { label: "Base Sepolia", minUsd: "0.25", explorer: "https://sepolia.basescan.org/tx/" },
} as const;
export type Destination = keyof typeof DESTINATIONS;
export const isDestination = (d: string): d is Destination => d in DESTINATIONS;

export type PayoutStatus = "sending" | "bridging" | "done" | "bridge_failed" | "failed";
export type PayoutDetail = {
  payoutId: string;
  destination: Destination;
  status: PayoutStatus;
  memoTx?: string; // Arc transaction with the memo
  memoVerified?: boolean; // we read it back from Arc and it matched
  bridgeSteps?: { name: string; txHash?: string; url?: string }[];
  bridgedUsd?: string; // amount sent into CCTP (payout minus Arc gas)
  feesUsd?: string; // estimated transfer fees
  error?: string;
  reversalOf?: number; // set on a reversal row
};

export class CashOutError extends Error {}

// Arc gas reserve if App Kit can't estimate approve + burn (estimate was ~$0.032).
const FALLBACK_ARC_GAS_USD = "0.04";

const newPayoutId = () => `PO-${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;

/** Main entry: cash out `amountUsd` of the user's balance to `destination`. */
export async function cashOut(
  db: SupabaseClient,
  user: { id: string; walletAddress: string },
  amountUsd: string,
  destination: Destination,
): Promise<PayoutDetail> {
  // --- 1. Check the request against the ledger (cheap, no money moves) ---
  let amount: bigint;
  try {
    amount = toMicro(amountUsd.trim());
  } catch {
    throw new CashOutError("Please enter an amount like 0.25");
  }
  const min = toMicro(DESTINATIONS[destination].minUsd);
  if (amount < min) throw new CashOutError(`The minimum for ${DESTINATIONS[destination].label} is $${DESTINATIONS[destination].minUsd}.`);
  const before = await totalsFor(db, user.id);
  if (amount > before.balance) throw new CashOutError("That's more than your balance.");

  // For Base Sepolia, work out the fees first: if they'd eat the whole
  // amount, stop here, before any money moves.
  const plan = destination === "base_sepolia" ? await planBridge(user.walletAddress, amount) : null;

  // --- 2. Write the payout row FIRST (balance drops now), then re-check ---
  const detail: PayoutDetail = { payoutId: newPayoutId(), destination, status: "sending" };
  const { data: row, error } = await db
    .from("ledger_entries")
    .insert({ user_id: user.id, kind: "payout", amount_usd: `-${toUsd(amount)}`, detail })
    .select("id")
    .single();
  if (error || !row) throw new Error(`Could not record payout: ${error?.message}`);
  const rowId: number = row.id;

  // Two cash-outs at the same moment would both pass step 1. After both rows
  // exist, the balance is negative, so each one sees it and backs out.
  if ((await totalsFor(db, user.id)).balance < 0n) {
    await reverse(db, user.id, rowId, amount, detail, "Balance changed during cash-out");
    throw new CashOutError("That's more than your balance.");
  }

  // --- 3. Platform wallet → author's Arc wallet, payout ID in the memo ---
  try {
    const memoTx = await sendMemoPayment(user.walletAddress as Address, toUsd(amount), detail.payoutId);
    detail.memoTx = memoTx;
    detail.memoVerified = await verifyMemoPayment(memoTx, user.walletAddress as Address, amount, detail.payoutId);
  } catch (e) {
    await reverse(db, user.id, rowId, amount, detail, (e as Error).message);
    throw new CashOutError("The payment didn't go through, so your balance was not changed. Please try again.");
  }

  if (destination === "arc") {
    return save(db, rowId, { ...detail, status: "done" });
  }

  // --- 4. Bridge from the author's Arc wallet to Base Sepolia (CCTP) ---
  // The money is already the author's (step 3 succeeded), so a bridge failure
  // is NOT reversed: it stays in their Arc account and we say so.
  await save(db, rowId, { ...detail, status: "bridging" });
  try {
    const bridged = await bridgeToBaseSepolia(plan!);
    return save(db, rowId, { ...detail, ...bridged, status: "done" });
  } catch (e) {
    console.error("Bridge failed", detail.payoutId, e);
    return save(db, rowId, { ...detail, status: "bridge_failed", error: (e as Error).message.slice(0, 300) });
  }
}

/** Arc memo payment from the platform wallet. Returns the Arc tx hash. */
async function sendMemoPayment(to: Address, amountUsd: string, payoutId: string): Promise<Hex> {
  const res = await circle.createContractExecutionTransaction({
    walletId: requireEnv("TREASURY_WALLET_ID"),
    contractAddress: MEMO_ADDRESS,
    callData: buildMemoTransferCall(to, amountUsd, payoutId),
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    refId: payoutId, // Circle-side label only
  });
  const txId = res.data?.id;
  if (!txId) throw new Error("Circle did not return a transaction id");
  const result = await waitForTransaction(txId);
  if (result.state !== "COMPLETE" || !result.txHash) {
    throw new Error(`Payout transaction ${result.state} ${result.errorReason ?? ""}`);
  }
  return result.txHash as Hex;
}

/** "Trust the chain": read the transaction back from Arc and check every part. */
async function verifyMemoPayment(txHash: Hex, to: Address, amount: bigint, payoutId: string): Promise<boolean> {
  const p = await readMemoPayment(txHash);
  return (
    p.success &&
    p.memoText === payoutId &&
    p.memoId === payoutMemoId(payoutId) &&
    !!p.to &&
    isAddressEqual(p.to, to) &&
    p.amountUsdc !== null &&
    toMicro(p.amountUsdc) === amount
  );
}

/**
 * CCTP with App Kit. The author's own Circle wallet signs approve + burn on
 * Arc (gas in USDC from the same money), then Circle's forwarder mints on
 * Base Sepolia to the author's same address (fee taken from the minted USDC).
 */
async function planBridge(walletAddress: string, payout: bigint) {
  const adapter = createCircleWalletsAdapter({
    apiKey: requireEnv("CIRCLE_API_KEY"),
    entitySecret: requireEnv("CIRCLE_ENTITY_SECRET"),
  });
  const kit = new AppKit();
  const from = { adapter, chain: "Arc_Testnet" as const, address: walletAddress };
  const to = { chain: "Base_Sepolia" as const, recipientAddress: walletAddress, useForwarder: true as const };

  // Arc gas for approve + burn comes out of the payout, so bridge a bit less.
  // If the kit can't estimate a step, keep a safe fixed reserve instead.
  const estimate = await kit.estimateBridge({ from, to, amount: toUsd(payout), config: { transferSpeed: "FAST" } });
  const arcSteps = estimate.gasFees.filter((g) => g.blockchain === "Arc_Testnet");
  let gas = 0n;
  for (const g of arcSteps) gas += g.fees ? ceilMicro(g.fees.fee) : 0n;
  if (arcSteps.length === 0 || arcSteps.some((g) => !g.fees)) gas = toMicro(FALLBACK_ARC_GAS_USD);
  let fees = gas;
  for (const f of estimate.fees) if (f.amount) fees += ceilMicro(f.amount);
  const amount = payout - gas;
  if (amount <= fees - gas) {
    throw new CashOutError(`Transfer fees are about $${toUsd(fees)} right now, so please cash out more than that.`);
  }
  return { kit, from, to, amount, fees };
}

async function bridgeToBaseSepolia({ kit, from, to, amount, fees }: Awaited<ReturnType<typeof planBridge>>) {
  const result = await kit.bridge({ from, to, amount: toUsd(amount), config: { transferSpeed: "FAST" } });
  const bridgeSteps = result.steps.map((s) => ({ name: s.name, txHash: s.txHash, url: s.explorerUrl }));
  if (result.state !== "success") {
    const failed = result.steps.find((s) => s.state === "error");
    throw new Error(`Bridge ${result.state} at ${failed?.name ?? "unknown step"}`);
  }
  return { bridgeSteps, bridgedUsd: toUsd(amount), feesUsd: toUsd(fees) };
}

// Fees come as decimal strings ("0.0074220496…"); round UP to whole micro-dollars.
function ceilMicro(usd: string): bigint {
  const [whole, frac = ""] = usd.split(".");
  const micro = toMicro(`${whole}.${frac.slice(0, 6) || "0"}`);
  return /[1-9]/.test(frac.slice(6)) ? micro + 1n : micro;
}

async function save(db: SupabaseClient, rowId: number, detail: PayoutDetail): Promise<PayoutDetail> {
  const { error } = await db.from("ledger_entries").update({ detail }).eq("id", rowId);
  if (error) console.error("Could not update payout", detail.payoutId, error.message);
  return detail;
}

/** Give the money back: a positive payout row pointing at the failed one. */
async function reverse(db: SupabaseClient, userId: string, rowId: number, amount: bigint, detail: PayoutDetail, reason: string) {
  await save(db, rowId, { ...detail, status: "failed", error: reason.slice(0, 300) });
  const { error } = await db.from("ledger_entries").insert({
    user_id: userId,
    kind: "payout",
    amount_usd: toUsd(amount),
    detail: { payoutId: detail.payoutId, destination: detail.destination, status: "failed", reversalOf: rowId },
  });
  if (error) console.error("COULD NOT REVERSE PAYOUT", detail.payoutId, error.message);
}

/** The user's cash-outs, newest first (reversal rows hidden; their originals show "failed"). */
export async function listPayouts(db: SupabaseClient, userId: string) {
  const { data } = await db
    .from("ledger_entries")
    .select("id, amount_usd, detail, created_at")
    .eq("user_id", userId)
    .eq("kind", "payout")
    .order("created_at", { ascending: false });
  return (data ?? [])
    .filter((r) => !(r.detail as PayoutDetail | null)?.reversalOf)
    .map((r) => ({ id: r.id as number, amountUsd: String(r.amount_usd).replace("-", ""), createdAt: r.created_at as string, detail: r.detail as PayoutDetail }));
}
