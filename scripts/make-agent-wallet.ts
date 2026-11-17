/**
 * ONE-TIME SETUP: create the tutor agent's own wallet.
 *
 * Why does the agent need its own key?
 *   Circle's GatewayClient (the buyer side of Gateway Nanopayments) signs each
 *   payment with a raw private key. So the agent gets a fresh key that holds
 *   only its small budget (a few test dollars). If it ever leaked, the most
 *   anyone could take is that budget.
 *
 * What this script does:
 *   1. Makes a random private key (viem's generatePrivateKey).
 *   2. Writes AGENT_PRIVATE_KEY and AGENT_ADDRESS into .env (gitignored).
 *   3. Prints ONLY the public address. The key is never printed.
 *
 * Run: npm run make-agent-wallet
 */
import { readFileSync, writeFileSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

// Safety check: never overwrite an existing agent key (it may hold funds).
if (process.env.AGENT_PRIVATE_KEY) {
  throw new Error("AGENT_PRIVATE_KEY is already set in .env. Nothing to do.");
}

const privateKey = generatePrivateKey(); // 32 random bytes as 0x-hex
const address = privateKeyToAccount(privateKey).address; // the public "account number"

// Fill in empty KEY= lines if they exist, otherwise add them at the end.
let env = readFileSync(".env", "utf8");
for (const [name, value] of [["AGENT_PRIVATE_KEY", privateKey], ["AGENT_ADDRESS", address]]) {
  const pattern = new RegExp(`^${name}=.*$`, "m");
  env = pattern.test(env) ? env.replace(pattern, `${name}=${value}`) : env.trimEnd() + `\n${name}=${value}\n`;
}
writeFileSync(".env", env);

console.log("Agent wallet created. Key saved to .env (not printed).");
console.log(`Agent address: ${address}`);
console.log("Next: npm run pay -- fund-agent 2");
