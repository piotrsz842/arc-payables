/**
 * How much does a cash-out to another testnet chain cost? Asks App Kit for an
 * estimate (no money moves). Source = the platform wallet on Arc.
 *
 * Run: npm run bridge-estimate -- 0.10
 */
import { createCircleWalletsAdapter } from "@circle-fin/adapter-circle-wallets";
import { AppKit } from "@circle-fin/app-kit";
import { requireEnv } from "../lib/circle.js";

const amount = process.argv[2] ?? "0.10";
const adapter = createCircleWalletsAdapter({
  apiKey: requireEnv("CIRCLE_API_KEY"),
  entitySecret: requireEnv("CIRCLE_ENTITY_SECRET"),
});
const address = requireEnv("TREASURY_WALLET_ADDRESS");
const kit = new AppKit();

const show = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));

// (OP_Sepolia was also tried 2026-11-17: not a CCTP bridge chain in App Kit.)
for (const chain of ["Ethereum_Sepolia", "Base_Sepolia", "Arbitrum_Sepolia"] as const) {
  for (const useForwarder of [true, false]) {
    try {
      const estimate = await kit.estimateBridge({
        from: { adapter, chain: "Arc_Testnet", address },
        to: useForwarder
          ? { chain, recipientAddress: address, useForwarder: true }
          : { adapter, chain, address, recipientAddress: address },
        amount,
        config: { transferSpeed: "FAST" },
      });
      const fees = estimate.fees.map((f) => `${f.type}=${f.amount}`).join(" ");
      console.log(`${chain.padEnd(17)} forwarder=${String(useForwarder).padEnd(5)} fees: ${fees}`);
      if (!useForwarder) for (const g of estimate.gasFees) console.log(`   gas ${g.name} on ${g.blockchain}: ${show(g.fees)}`);
    } catch (e) {
      console.log(`${chain.padEnd(17)} forwarder=${useForwarder}: ${(e as Error).message.slice(0, 160)}`);
    }
  }
}
