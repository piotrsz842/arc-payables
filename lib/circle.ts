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
//
// Created on FIRST USE, not when this file loads: Next.js loads every page
// while building, and the build must not need (or crash without) the keys.
type CircleClient = ReturnType<typeof initiateDeveloperControlledWalletsClient>;
let client: CircleClient | undefined;
function getCircle(): CircleClient {
  client ??= initiateDeveloperControlledWalletsClient({
    apiKey: requireEnv("CIRCLE_API_KEY"),
    entitySecret: requireEnv("CIRCLE_ENTITY_SECRET"),
  });
  return client;
}

/** Use like the real client (`circle.createWallets(...)`); it's created on the first call. */
export const circle = new Proxy({} as CircleClient, {
  get(_target, name) {
    const real = getCircle();
    const value = Reflect.get(real, name);
    return typeof value === "function" ? value.bind(real) : value;
  },
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
