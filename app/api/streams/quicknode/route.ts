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

/** Why a request was rejected (or "ok"). Logged, never the secrets themselves. */
// --- Temporary diagnostics (no secrets): what QuickNode actually sends. ---
// Saved to the private storage bucket so we can compare with the chain.
let deliveries = 0;
async function saveDebugSample(payload: unknown, body: string, logs: Log[]) {
  deliveries++;
  const blocks = logs.map((l) => (l.blockNumber ? Number(l.blockNumber) : 0)).filter(Boolean);
  const meta = (payload as { metadata?: unknown })?.metadata ?? null;
  const summary = { at: new Date().toISOString(), maxBlock: blocks.length ? Math.max(...blocks) : null, logs: logs.length, metadata: meta, topKeys: Object.keys((payload as object) ?? {}) };
  const put = (path: string, data: string) =>
    db.storage.from("handwritten").upload(path, new Blob([data], { type: "application/json" }), { upsert: true }).catch(() => null);
  // The newest block we've received (every 10th delivery, to keep it cheap).
  if (deliveries % 10 === 1) await put("_debug/quicknode/latest.json", JSON.stringify(summary));
  // Any delivery mentioning the Memo contract: keep it exactly as received.
  if (body.toLowerCase().includes("5294e9927c3306dcbadb03fe70b92e01ccede505")) {
    await put(`_debug/quicknode/memo-${Date.now()}.json`, body.slice(0, 200_000));
  }
}

function checkSignature(req: Request, body: string): string {
  const token = process.env.QUICKNODE_SECURITY_TOKEN;
  const nonce = req.headers.get("x-qn-nonce");
  const timestamp = req.headers.get("x-qn-timestamp");
  const given = req.headers.get("x-qn-signature");
  if (!token) return "QUICKNODE_SECURITY_TOKEN is not set on the server";
  if (!nonce || !timestamp || !given) return `missing headers (nonce: ${!!nonce}, timestamp: ${!!timestamp}, signature: ${!!given})`;
  // Reject old messages (replays). Accept unix seconds or milliseconds; the docs don't say which.
  const t = Number(timestamp);
  if (Number.isFinite(t)) {
    const seconds = t > 1e12 ? t / 1000 : t;
    if (Math.abs(Date.now() / 1000 - seconds) > 600) return `timestamp too old or in the future (${timestamp})`;
  }
  const expected = createHmac("sha256", token).update(nonce + timestamp + body).digest("hex");
  const ok = expected.length === given.length && timingSafeEqual(Buffer.from(expected), Buffer.from(given.toLowerCase()));
  return ok ? "ok" : `signature mismatch (body ${body.length} bytes, content-encoding: ${req.headers.get("content-encoding") ?? "none"})`;
}

export async function POST(req: Request) {
  const body = await req.text();
  const verdict = checkSignature(req, body);
  console.log(`[quicknode webhook] ${verdict}`); // visible in Vercel's function logs
  if (verdict !== "ok") return Response.json({ error: "bad signature" }, { status: 401 });

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
  const payload = JSON.parse(body);
  collect(payload);
  await saveDebugSample(payload, body, logs);
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
  console.log(`[quicknode webhook] logs: ${logs.length}, cash-outs confirmed: ${confirmed}`);
  // Always 2xx once verified: QuickNode waits for an answer before sending the next block.
  return Response.json({ ok: true, logs: logs.length, confirmed });
}
