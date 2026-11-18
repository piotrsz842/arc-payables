/**
 * Test the QuickNode webhook without QuickNode: take a real cash-out
 * transaction, shape its logs like a Streams "Logs" payload, sign it the way
 * QuickNode does, and POST it to our webhook.
 *
 * Run: npm run test-stream-webhook -- <arcTxHash> [baseUrl]
 */
import { createHmac, randomUUID } from "node:crypto";
import type { Hex } from "viem";
import { arcClient } from "../lib/arc.js";
import { requireEnv } from "../lib/circle.js";

const [txHash, base = "http://localhost:3000"] = process.argv.slice(2);
if (!txHash) throw new Error("Usage: npm run test-stream-webhook -- <arcTxHash> [baseUrl]");
const receipt = await arcClient.getTransactionReceipt({ hash: txHash as Hex });
const logs = receipt.logs.map((l) => ({
  address: l.address, topics: l.topics, data: l.data, transactionHash: l.transactionHash,
  blockNumber: `0x${l.blockNumber.toString(16)}`, logIndex: `0x${(l.logIndex ?? 0).toString(16)}`, removed: false,
}));
const body = JSON.stringify({ data: [[logs]], metadata: { dataset: "logs", network: "arc-testnet", stream_id: "local-test" } });
const nonce = randomUUID();
const timestamp = String(Math.floor(Date.now() / 1000));
const sign = (token: string) => createHmac("sha256", token).update(nonce + timestamp + body).digest("hex");

for (const [label, signature] of [["wrong signature", sign("not-the-token")], ["correct signature", sign(requireEnv("QUICKNODE_SECURITY_TOKEN"))]]) {
  const res = await fetch(`${base}/api/streams/quicknode`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-QN-Nonce": nonce, "X-QN-Timestamp": timestamp, "X-QN-Signature": signature },
    body,
  });
  console.log(`${label}: HTTP ${res.status} ${await res.text()}`);
}
