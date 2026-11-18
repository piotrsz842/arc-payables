/**
 * TOP UP: a student adds money to their balance.
 *
 * Real money flow (testnet USDC): the student's own Circle wallet deposits
 * USDC straight into the tutor agent's Circle GATEWAY balance (approve +
 * GatewayWallet.depositFor), which is the money the agent pays snippets with.
 * Only after both transactions are COMPLETE do we credit the ledger.
 *
 * On testnet a new wallet starts empty: the student gets test USDC from
 * Circle's faucet (shown behind "details"). In production this would be a
 * card/bank on-ramp, or USDC arriving from another chain via CCTP.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { usdcBalance } from "@/lib/arc";
import { depositForAgent } from "@/lib/gateway";
import { recordEntry, toMicro } from "@/lib/ledger";
import type { Address } from "viem";

export const TOP_UP_AMOUNTS = ["0.10", "0.50", "1.00"];
const GAS_ALLOWANCE_USD = "0.01"; // Arc's gas (two transactions) is paid in USDC, so keep a little extra

export class NotEnoughFundsError extends Error {}

export async function topUp(
  db: SupabaseClient,
  user: { id: string; walletId: string; walletAddress: string },
  amountUsd: string,
): Promise<string> {
  if (!TOP_UP_AMOUNTS.includes(amountUsd)) throw new Error("Unsupported top-up amount");

  const inWallet = await usdcBalance(user.walletAddress as Address);
  if (toMicro(inWallet) < toMicro(amountUsd) + toMicro(GAS_ALLOWANCE_USD)) {
    throw new NotEnoughFundsError(`Wallet has $${inWallet}, needs $${amountUsd} plus a little for fees.`);
  }

  const { approveTx, depositTx } = await depositForAgent(user.walletId, amountUsd, `topup:${user.id}`);
  await recordEntry(db, { userId: user.id, kind: "topup", amountUsd, detail: { approveTx, depositTx } });
  return depositTx;
}
