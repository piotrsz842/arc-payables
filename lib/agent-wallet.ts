/**
 * The tutor agent's wallet: a Circle GatewayClient (buyer side of Gateway
 * Nanopayments) signing with the agent's own key (AGENT_PRIVATE_KEY).
 * Its Gateway balance is the agent's spending money.
 *
 * Last-line guard: a hook that runs before the SDK signs ANY payment and
 * refuses anything above the per-snippet cap, whatever else went wrong.
 */
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { parseUnits, type Hex } from "viem";
import { LIMITS } from "./checker";

let agent: GatewayClient | undefined;

export function getAgent(): GatewayClient {
  if (agent) return agent;
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (!privateKey) throw new Error("Missing AGENT_PRIVATE_KEY");
  agent = new GatewayClient({ chain: "arcTestnet", privateKey: privateKey as Hex });
  agent.onBeforePaymentCreation(async (ctx) => {
    if (BigInt(ctx.selectedRequirements.amount) > parseUnits(LIMITS.maxPerPaymentUsd, 6)) {
      return { abort: true, reason: `Price is above the $${LIMITS.maxPerPaymentUsd} per-snippet cap` };
    }
  });
  return agent;
}
