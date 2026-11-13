/**
 * RISK TEST: can our Circle dev-controlled treasury turn USDC into EURC on
 * Arc testnet and deliver it to a contractor? (Needed for EUR invoices.)
 *
 * Run:
 *   npm run swap -- estimate 1    → quote only, no money moves
 *   npm run swap -- swap 1        → swap 1 USDC → EURC, EURC sent to the contractor
 *
 * Uses Circle App Kit Swap with the Circle Wallets adapter.
 * Docs (checked 2026-11-13):
 *   https://docs.arc.io/app-kit/swap
 *   https://docs.arc.io/app-kit/quickstarts/swap-tokens-same-chain
 *   https://docs.arc.io/app-kit/tutorials/swap/specify-recipient-address
 *
 * Testnet liquidity is thin: if you get ONCHAIN_SIMULATION_FAILED,
 * raise SLIPPAGE_BPS (the docs' advice).
 */
import { AppKit } from "@circle-fin/app-kit";
import { createCircleWalletsAdapter } from "@circle-fin/adapter-circle-wallets";
import { type Address } from "viem";
import { eurcBalance } from "../lib/arc.js";
import { requireEnv } from "../lib/circle.js";

// Max price movement we accept between quote and execution. 300 bps = 3%.
const SLIPPAGE_BPS = 300;

const kit = new AppKit();
// The adapter lets App Kit ask Circle to sign with our dev-controlled wallets.
const adapter = createCircleWalletsAdapter({
  apiKey: requireEnv("CIRCLE_API_KEY"),
  entitySecret: requireEnv("CIRCLE_ENTITY_SECRET"),
});

const treasury = requireEnv("TREASURY_WALLET_ADDRESS");
const contractor = requireEnv("CONTRACTOR_WALLET_ADDRESS") as Address;

// Same parameters for the quote and the real swap.
function swapParams(amountUsdc: string) {
  return {
    // App Kit identifies the wallet by ADDRESS (not wallet ID).
    from: { adapter, chain: "Arc_Testnet" as const, address: treasury },
    // Deliver the EURC directly to the contractor (treasury still pays).
    to: { recipientAddress: contractor },
    tokenIn: "USDC" as const,
    tokenOut: "EURC" as const,
    amountIn: amountUsdc, // human units, e.g. "1" = 1 USDC
    config: { apiKey: requireEnv("CIRCLE_API_KEY"), slippageBps: SLIPPAGE_BPS },
  };
}

async function estimate(amountUsdc: string) {
  const quote = await kit.estimateSwap(swapParams(amountUsdc));
  console.log(`Quote for ${amountUsdc} USDC → EURC:`);
  console.log(`  estimated output: ${quote.estimatedOutput?.amount} ${quote.estimatedOutput?.token}`);
  console.log(`  worst case (after slippage): ${quote.stopLimit?.amount} ${quote.stopLimit?.token}`);
  for (const f of quote.fees ?? []) console.log(`  fee: ${f.amount} ${f.token} (${f.type})`);
}

async function swap(amountUsdc: string) {
  await estimate(amountUsdc);

  // "Trust the chain": read the contractor's EURC balance before and after.
  const before = await eurcBalance(contractor);
  console.log(`\nContractor EURC before: ${before}`);
  console.log("Swapping...");

  const result = await kit.swap(swapParams(amountUsdc));
  console.log(`  status: ${result.progress?.status}`);
  console.log(`  tx: ${result.explorerUrl ?? result.txHash}`);
  console.log(`  amountOut (as reported by App Kit): ${result.amountOut}`);

  const after = await eurcBalance(contractor);
  console.log(`\nContractor EURC after:  ${after}`);
  console.log(`Arc says contractor received: ${(Number(after) - Number(before)).toFixed(6)} EURC`);
}

const [command, amount = "1"] = process.argv.slice(2);
try {
  if (command === "estimate") await estimate(amount);
  else if (command === "swap") await swap(amount);
  else console.log("Usage: npm run swap -- estimate <usdc> | swap <usdc>");
} catch (err: any) {
  // App Kit errors carry a code (e.g. ONCHAIN_SIMULATION_FAILED) and a message.
  console.error("Swap failed:", err?.code ?? "", err?.message ?? err);
  process.exit(1);
}
