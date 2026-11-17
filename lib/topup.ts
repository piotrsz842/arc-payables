/**
 * TOP UP: a student adds money to their balance.
 *
 * Real money flow (testnet USDC): the student's own Circle wallet sends USDC
 * to the tutor agent's wallet (whose Gateway balance pays for snippets).
 * Only after Circle reports the transfer COMPLETE do we credit the ledger.
 *
 * On testnet a new wallet starts empty: the student gets test USDC from
 * Circle's faucet (shown behind "details"). In production this would be a
 * card/bank on-ramp, or USDC arriving from another chain via CCTP.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BLOCKCHAIN, USDC_ADDRESS, usdcBalance } from "@/lib/arc";
import { circle, waitForTransaction } from "@/lib/circle";
import { recordEntry, toMicro } from "@/lib/ledger";
import type { Address } from "viem";

export const TOP_UP_AMOUNTS = ["0.10", "0.50", "1.00"];
const GAS_ALLOWANCE_USD = "0.01"; // Arc's gas is paid in USDC, so keep a little extra

export class NotEnoughFundsError extends Error {}

export async function topUp(
  db: SupabaseClient,
  user: { id: string; walletAddress: string },
  amountUsd: string,
): Promise<string> {
  if (!TOP_UP_AMOUNTS.includes(amountUsd)) throw new Error("Unsupported top-up amount");
  const agentAddress = process.env.AGENT_ADDRESS;
  if (!agentAddress) throw new Error("Missing AGENT_ADDRESS");

  const inWallet = await usdcBalance(user.walletAddress as Address);
  if (toMicro(inWallet) < toMicro(amountUsd) + toMicro(GAS_ALLOWANCE_USD)) {
    throw new NotEnoughFundsError(`Wallet has $${inWallet}, needs $${amountUsd} plus a little for fees.`);
  }

  const res = await circle.createTransaction({
    blockchain: BLOCKCHAIN,
    walletAddress: user.walletAddress,
    tokenAddress: USDC_ADDRESS,
    destinationAddress: agentAddress,
    amount: [amountUsd],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    refId: `topup:${user.id}`,
  });
  const txId = res.data?.id;
  if (!txId) throw new Error("Circle did not return a transaction id");

  const result = await waitForTransaction(txId);
  if (result.state !== "COMPLETE" || !result.txHash) {
    throw new Error(`Top-up did not complete: ${result.state} ${result.errorReason ?? ""}`);
  }
  await recordEntry(db, { userId: user.id, kind: "topup", amountUsd, detail: { txHash: result.txHash } });
  return result.txHash;
}
