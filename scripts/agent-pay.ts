/**
 * STAGE 1: the tutor agent buys a note snippet over x402, paying from its
 * Circle Gateway balance (Gateway Nanopayments on Arc testnet).
 *
 * Run (with `npm run dev` running in another terminal for `buy`):
 *   npm run agent-pay -- balance          → agent wallet, agent Gateway budget, platform earnings
 *   npm run agent-pay -- deposit 1        → move 1 USDC from the agent wallet into Gateway
 *   npm run agent-pay -- buy demo-1       → pay for /api/snippets/demo-1 and print it
 *
 * Two different balances (important for judges' questions):
 *   - WALLET balance: plain USDC sitting in the agent's address on Arc.
 *   - GATEWAY balance: USDC the agent deposited into Circle Gateway's contract.
 *     Payments are signed against THIS balance, offchain, so each one needs no gas.
 *     This is the agent's spending budget.
 *
 * Docs: https://developers.circle.com/gateway/nanopayments/quickstarts/buyer
 */
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { formatUnits, parseUnits, type Address, type Hex } from "viem";
import { EXPLORER, USDC_DECIMALS } from "../lib/arc.js";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
// Hard ceiling per payment. A safety net under the Stage 2 checker: even if
// everything else goes wrong, the agent can never sign a payment above this.
const MAX_PER_PAYMENT_USD = "0.01";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
}

const agent = new GatewayClient({ chain: "arcTestnet", privateKey: requireEnv("AGENT_PRIVATE_KEY") as Hex });
const platform = requireEnv("TREASURY_WALLET_ADDRESS") as Address;

// Runs right before the SDK signs ANY payment. Returning abort cancels it.
agent.onBeforePaymentCreation(async (ctx) => {
  const amount = BigInt(ctx.selectedRequirements.amount);
  console.log(`  asked to pay ${formatUnits(amount, USDC_DECIMALS)} USDC to ${ctx.selectedRequirements.payTo}`);
  if (amount > parseUnits(MAX_PER_PAYMENT_USD, USDC_DECIMALS)) {
    return { abort: true, reason: `Price is above the $${MAX_PER_PAYMENT_USD} per-payment cap` };
  }
});

async function balance() {
  const mine = await agent.getBalances();
  const theirs = await agent.getBalances(platform); // anyone's Gateway balance is public
  console.log(`Agent ${agent.address}`);
  console.log(`  wallet:          ${mine.wallet.formatted} USDC`);
  console.log(`  Gateway budget:  ${mine.gateway.formattedAvailable} USDC available (${mine.gateway.formattedTotal} total)`);
  console.log(`Platform ${platform}`);
  console.log(`  Gateway earnings: ${theirs.gateway.formattedAvailable} USDC available (${theirs.gateway.formattedTotal} total)`);
}

async function deposit(amount: string) {
  console.log(`Depositing ${amount} USDC into Gateway (an approve tx, then a deposit tx)...`);
  const result = await agent.deposit(amount);
  if (result.approvalTxHash) console.log(`  approve: ${EXPLORER}/tx/${result.approvalTxHash}`);
  console.log(`  deposit: ${EXPLORER}/tx/${result.depositTxHash}`);
  await balance();
}

async function buy(snippetId: string) {
  const url = `${BASE_URL}/api/snippets/${snippetId}`;
  console.log(`Buying ${url}`);
  const started = Date.now();
  const result = await agent.pay<{ title: string; content: string }>(url);
  console.log(`\nPaid ${result.formattedAmount} USDC in ${Date.now() - started} ms (HTTP ${result.status})`);
  console.log(`  Gateway settlement reference: ${result.transaction}`);
  console.log(`  got: "${result.data.title}": ${result.data.content}\n`);
  await balance();
}

const [command, arg] = process.argv.slice(2);
if (command === "balance") await balance();
else if (command === "deposit") await deposit(arg ?? "1");
else if (command === "buy") await buy(arg ?? "demo-1");
else console.log("Usage: npm run agent-pay -- balance | deposit <usdc> | buy <snippetId>");
