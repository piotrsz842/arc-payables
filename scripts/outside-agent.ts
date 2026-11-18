/**
 * AN OUTSIDE AI AGENT that buys our students' notes.
 *
 * It has NO account on our platform and uses NONE of our code: just public
 * HTTP and Circle's own x402 client. This is the point of x402: any agent
 * with a Gateway balance can find a note and pay for it in the same request,
 * no signup, no API key, no invoice. The author is credited all the same.
 *
 *   npm run outside-agent -- setup                 make this agent's own key (saved to .env, not printed)
 *   npm run outside-agent -- balance               its wallet and Gateway balance
 *   npm run outside-agent -- deposit 0.1           move USDC from its wallet into Gateway (its spending money)
 *   npm run outside-agent -- buy "quicksort pivot" [course]
 *
 * Fund it first: npm run pay -- send 0.2 <its address>
 * Site: OUTSIDE_AGENT_SITE (default: the live site).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { GatewayClient } from "@circle-fin/x402-batching/client";
import type { Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const SITE = process.env.OUTSIDE_AGENT_SITE ?? "https://arc-payables-chi.vercel.app";
const MAX_PRICE_USD = 0.005; // this agent's own spending rule: it decides for itself what is worth buying

function setup() {
  if (process.env.OUTSIDE_AGENT_PRIVATE_KEY) throw new Error("OUTSIDE_AGENT_PRIVATE_KEY is already set in .env.");
  const key = generatePrivateKey();
  const address = privateKeyToAccount(key).address;
  let env = readFileSync(".env", "utf8");
  for (const [name, value] of [["OUTSIDE_AGENT_PRIVATE_KEY", key], ["OUTSIDE_AGENT_ADDRESS", address]]) {
    const pattern = new RegExp(`^${name}=.*$`, "m");
    env = pattern.test(env) ? env.replace(pattern, `${name}=${value}`) : env.trimEnd() + `\n${name}=${value}\n`;
  }
  writeFileSync(".env", env);
  console.log(`Outside agent created (key saved to .env, not printed). Address: ${address}`);
  console.log(`Next: npm run pay -- send 0.2 ${address}   then   npm run outside-agent -- deposit 0.1`);
}

function client() {
  const key = process.env.OUTSIDE_AGENT_PRIVATE_KEY;
  if (!key) throw new Error("Run `npm run outside-agent -- setup` first.");
  return new GatewayClient({ chain: "arcTestnet", privateKey: key as Hex });
}

async function balance(agent = client()) {
  const b = await agent.getBalances();
  console.log(`Outside agent ${agent.address}: wallet ${b.wallet.formatted} USDC, Gateway ${b.gateway.formattedAvailable} USDC available`);
}

type Preview = { id: string; title: string; course: string; summary: string; priceUsd: string };

async function buy(query: string, course?: string) {
  const agent = client();

  // 1. Browse for free: anyone can read previews.
  const params = new URLSearchParams({ q: query, ...(course ? { course } : {}) });
  const previews = (await (await fetch(`${SITE}/api/snippets?${params}`)).json()) as Preview[];
  console.log(`Found ${previews.length} previews for "${query}" on ${SITE}`);
  for (const p of previews.slice(0, 5)) console.log(`  ${p.id}  $${p.priceUsd}  [${p.course}] ${p.title}: ${p.summary}`);
  const pick = previews.find((p) => Number(p.priceUsd) <= MAX_PRICE_USD);
  if (!pick) return console.log("Nothing affordable matched. Buying nothing.");

  // 2. Ask for the content without paying: the server answers 402 with its price.
  const url = `${SITE}/api/snippets/${pick.id}`;
  const unpaid = await fetch(url);
  const offer = JSON.parse(Buffer.from(unpaid.headers.get("payment-required") ?? "", "base64").toString());
  const terms = offer.accepts?.[0];
  console.log(`\nGET ${url} → HTTP ${unpaid.status}`);
  console.log(`  the server wants ${Number(terms.amount) / 1e6} USDC (${terms.scheme}, ${terms.network}) paid to ${terms.payTo}`);

  // 3. Pay and get it, in one step. Circle's client signs a Gateway payment and retries the request.
  const started = Date.now();
  const paid = await agent.pay<{ title: string; content: string }>(url);
  console.log(`\nPaid ${paid.formattedAmount} USDC in ${Date.now() - started} ms (HTTP ${paid.status}), Gateway transfer ${paid.transaction}`);
  console.log(`"${paid.data.title}":\n${paid.data.content.slice(0, 400)}${paid.data.content.length > 400 ? "…" : ""}\n`);
  await balance(agent);
}

const [command, a, b] = process.argv.slice(2);
if (command === "setup") setup();
else if (command === "balance") await balance();
else if (command === "deposit") {
  const r = await client().deposit(a ?? "0.1");
  console.log(`Deposited. tx ${r.depositTxHash}`);
  await balance();
} else if (command === "buy" && a) await buy(a, b);
else console.log('Usage: npm run outside-agent -- setup | balance | deposit <usdc> | buy "<words>" [course]');
