/**
 * Our connection to Circle's developer-controlled wallets.
 * Docs: https://developers.circle.com/wallets/dev-controlled/create-your-first-wallet
 */
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
}

// Every Circle call goes through this client. The SDK encrypts the entity
// secret into a fresh single-use ciphertext for each request.
export const circle = initiateDeveloperControlledWalletsClient({
  apiKey: requireEnv("CIRCLE_API_KEY"),
  entitySecret: requireEnv("CIRCLE_ENTITY_SECRET"),
});

const FINAL_STATES = ["COMPLETE", "FAILED", "CANCELLED", "DENIED"];

/**
 * Circle processes transactions in the background, so we ask every 3 seconds
 * until it reaches a final state. Returns the final state and the onchain hash.
 */
export async function waitForTransaction(txId: string) {
  while (true) {
    await new Promise((r) => setTimeout(r, 3000));
    const res = await circle.getTransaction({ id: txId });
    const tx = res.data?.transaction;
    console.log(`  state: ${tx?.state}`);
    if (tx?.state && FINAL_STATES.includes(tx.state)) {
      return { state: tx.state, txHash: tx.txHash, errorReason: tx.errorReason };
    }
  }
}
