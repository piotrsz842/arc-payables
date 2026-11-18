import { GatewayClient } from "@circle-fin/x402-batching/client";
const c = new GatewayClient({ chain: "arcTestnet", privateKey: process.env.OUTSIDE_AGENT_PRIVATE_KEY as `0x${string}` });
for (const [name, addr] of [["platform", process.env.TREASURY_WALLET_ADDRESS], ["tutor agent", process.env.AGENT_ADDRESS]] as const) {
  const b = await c.getBalances(addr as `0x${string}`);
  console.log(`${name}: wallet ${b.wallet.formatted}, Gateway available ${b.gateway.formattedAvailable}, total ${b.gateway.formattedTotal}, withdrawing ${b.gateway.formattedWithdrawing ?? "?"}`);
}
