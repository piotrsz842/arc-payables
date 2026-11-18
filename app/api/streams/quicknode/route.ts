/**
 * QuickNode Stream webhook: independent on-chain confirmation of cash-outs.
 *
 * A QuickNode Stream on Arc testnet (Logs dataset) watches the Memo contract
 * and forwards every Memo event sent by OUR platform wallet. Each cash-out
 * carries its payout ID in that memo, so when the event arrives we mark the
 * matching cash-out "confirmed on chain", seen by a third party watching the
 * chain, not just by our own code.
 *
 * Security: QuickNode signs each request: X-QN-Signature = hex HMAC-SHA256 of
 * (X-QN-Nonce + X-QN-Timestamp + body) with the stream's security token
 * (QUICKNODE_SECURITY_TOKEN). Unsigned or wrongly signed requests get 401.
 * Docs: https://www.quicknode.com/guides/quicknode-products/streams/validating-incoming-streams-webhook-messages
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { decodeEventLog, hexToString, isAddressEqual, type Address, type Hex } from "viem";
import { MEMO_ADDRESS, memoAbi } from "@/lib/arc";
import { db } from "@/lib/supabase/admin";

type Log = { address?: string; topics?: Hex[]; data?: Hex; transactionHash?: string; blockNumber?: string };

function validSignature(req: Request, body: string): boolean {
  const token = process.env.QUICKNODE_SECURITY_TOKEN;
  const nonce = req.headers.get("x-qn-nonce");
  const timestamp = req.headers.get("x-qn-timestamp");
  const given = req.headers.get("x-qn-signature");
  if (!token || !nonce || !timestamp || !given) return false;
  // Reject old messages (replays): QuickNode timestamps are unix seconds.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 600) return false;
  const expected = createHmac("sha256", token).update(nonce + timestamp + body).digest("hex");
  return expected.length === given.length && timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

export async function POST(req: Request) {
  const body = await req.text();
  if (!validSignature(req, body)) return Response.json({ error: "bad signature" }, { status: 401 });

  // Raw Logs payloads nest arrays (per block, per transaction), and a filter
  // can return its own shape: collect every object that looks like a log.
  const logs: Log[] = [];
  const collect = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(collect);
    else if (v && typeof v === "object") {
      if (Array.isArray((v as Log).topics) && typeof (v as Log).address === "string") logs.push(v as Log);
      else Object.values(v).forEach(collect);
    }
  };
  collect(JSON.parse(body));
  const platform = process.env.TREASURY_WALLET_ADDRESS as Address;
  let confirmed = 0;

  for (const log of logs) {
    if (!log.address || !isAddressEqual(log.address as Address, MEMO_ADDRESS)) continue;
    let event;
    try {
      event = decodeEventLog({ abi: memoAbi, data: log.data ?? "0x", topics: log.topics as [Hex, ...Hex[]] });
    } catch {
      continue; // not a Memo event
    }
    if (event.eventName !== "Memo" || !isAddressEqual(event.args.sender, platform)) continue;
    const payoutId = hexToString(event.args.memo);
    if (!payoutId.startsWith("PO-")) continue;

    // Find that cash-out in the ledger and stamp it.
    const { data: rows } = await db.from("ledger_entries").select("id, detail").eq("kind", "payout").eq("detail->>payoutId", payoutId);
    const row = (rows ?? []).find((r) => !(r.detail as { reversalOf?: number })?.reversalOf);
    if (!row) continue;
    const detail = { ...(row.detail as object), onchain: { by: "QuickNode Stream", txHash: log.transactionHash, block: log.blockNumber, at: new Date().toISOString() } };
    await db.from("ledger_entries").update({ detail }).eq("id", row.id);
    confirmed++;
  }
  // Always 2xx once verified: QuickNode waits for an answer before sending the next block.
  return Response.json({ ok: true, logs: logs.length, confirmed });
}
