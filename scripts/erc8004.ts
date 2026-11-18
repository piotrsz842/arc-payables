/**
 * ERC-8004 setup for the tutor agent (one time), plus checks.
 *
 *   npm run erc8004 -- setup-checker        create + fund the checker's own Circle wallet (writes CHECKER_WALLET_ID/ADDRESS to .env)
 *   npm run erc8004 -- register <url>       platform wallet registers the tutor; <url> = its metadata, e.g. https://<site>/agent.json
 *                                           (writes TUTOR_AGENT_ID to .env)
 *   npm run erc8004 -- show                 read the identity back from Arc
 *   npm run erc8004 -- feedback-test        record one test reputation entry and wait for it
 */
import { readFileSync, writeFileSync } from "node:fs";
import type { Address, Hex } from "viem";
import { BLOCKCHAIN, EXPLORER, USDC_ADDRESS } from "../lib/arc.js";
import { circle, requireEnv, waitForTransaction } from "../lib/circle.js";
import { agentIdFromRegistration, IDENTITY_REGISTRY, readIdentity, recordPurchaseDiscipline, registerCall } from "../lib/erc8004.js";
import { createUserWallet } from "../lib/wallets.js";

function saveEnv(values: Record<string, string>) {
  let env = readFileSync(".env", "utf8");
  for (const [name, value] of Object.entries(values)) {
    const pattern = new RegExp(`^${name}=.*$`, "m");
    env = pattern.test(env) ? env.replace(pattern, `${name}=${value}`) : env.trimEnd() + `\n${name}=${value}\n`;
  }
  writeFileSync(".env", env);
}

async function send(walletId: string, contractAddress: Address, callData: Hex, refId: string) {
  const res = await circle.createContractExecutionTransaction({ walletId, contractAddress, callData, fee: { type: "level", config: { feeLevel: "MEDIUM" } }, refId });
  const r = await waitForTransaction(res.data!.id!);
  if (r.state !== "COMPLETE" || !r.txHash) throw new Error(`${refId}: ${r.state} ${r.errorReason ?? ""}`);
  return r.txHash as Hex;
}

const [command, arg] = process.argv.slice(2);
if (command === "setup-checker") {
  if (process.env.CHECKER_WALLET_ID) throw new Error("CHECKER_WALLET_ID is already set.");
  const wallet = await createUserWallet();
  saveEnv({ CHECKER_WALLET_ID: wallet.id, CHECKER_WALLET_ADDRESS: wallet.address });
  console.log(`Checker wallet ${wallet.address} (saved to .env). Funding it with 0.1 test USDC for gas...`);
  const res = await circle.createTransaction({
    blockchain: BLOCKCHAIN, walletAddress: requireEnv("TREASURY_WALLET_ADDRESS"), tokenAddress: USDC_ADDRESS,
    destinationAddress: wallet.address, amount: ["0.1"], fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  console.log(`  ${(await waitForTransaction(res.data!.id!)).state}`);
} else if (command === "register" && arg) {
  if (process.env.TUTOR_AGENT_ID) throw new Error(`Already registered as agent #${process.env.TUTOR_AGENT_ID}.`);
  const owner = requireEnv("TREASURY_WALLET_ADDRESS") as Address;
  const txHash = await send(requireEnv("TREASURY_WALLET_ID"), IDENTITY_REGISTRY, registerCall(arg), "erc8004:register");
  const agentId = await agentIdFromRegistration(txHash, owner);
  saveEnv({ TUTOR_AGENT_ID: agentId.toString() });
  console.log(`Registered the tutor as ERC-8004 agent #${agentId}: ${EXPLORER}/tx/${txHash} (TUTOR_AGENT_ID saved to .env)`);
} else if (command === "show") {
  const id = BigInt(requireEnv("TUTOR_AGENT_ID"));
  console.log(`Agent #${id}:`, await readIdentity(id));
} else if (command === "feedback-test") {
  const txId = await recordPurchaseDiscipline({ runId: "test", proposed: 3, allowed: 2 });
  if (!txId) throw new Error("Not set up (TUTOR_AGENT_ID / CHECKER_WALLET_ID)");
  const r = await waitForTransaction(txId);
  console.log(`Reputation feedback ${r.state}: ${EXPLORER}/tx/${r.txHash}`);
} else {
  console.log("Usage: npm run erc8004 -- setup-checker | register <metadataUrl> | show | feedback-test");
}
