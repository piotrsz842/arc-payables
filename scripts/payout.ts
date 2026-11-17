/**
 * Cash out from the command line (same code the dashboard uses).
 *
 *   npm run payout -- <email> <amountUsd> arc
 *   npm run payout -- <email> <amountUsd> base_sepolia
 *   npm run payout -- verify <arcTxHash> <payoutId>     read a payout back from Arc, no money moves
 *   npm run payout -- list <email>
 */
import { createClient } from "@supabase/supabase-js";
import type { Hex } from "viem";
import { EXPLORER, payoutMemoId, readMemoPayment } from "../lib/arc.js";
import { requireEnv } from "../lib/circle.js";
import { toUsd, totalsFor } from "../lib/ledger.js";
import { cashOut, isDestination, listPayouts } from "../lib/payouts.js";

const db = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false },
});

async function userByEmail(email: string) {
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  const authUser = data.users.find((u) => u.email === email);
  if (!authUser) throw new Error(`No user ${email}`);
  const { data: p } = await db.from("profiles").select("id, display_name, wallet_address").eq("id", authUser.id).single();
  if (!p) throw new Error(`No profile for ${email}`);
  return { id: p.id as string, name: p.display_name as string, walletAddress: p.wallet_address as string };
}

const [a, b, c] = process.argv.slice(2);
if (a === "verify" && b && c) {
  const p = await readMemoPayment(b as Hex);
  console.log({ ...p, memoIdMatches: p.memoId === payoutMemoId(c) });
} else if (a === "list" && b) {
  const user = await userByEmail(b);
  for (const p of await listPayouts(db, user.id)) console.log(p.createdAt, `$${p.amountUsd}`, p.detail);
} else if (a && b && c && isDestination(c)) {
  const user = await userByEmail(a);
  console.log(`${user.name}: balance $${toUsd((await totalsFor(db, user.id)).balance)}`);
  const started = Date.now();
  const result = await cashOut(db, user, b, c);
  console.log(`\nResult after ${((Date.now() - started) / 1000).toFixed(1)} s:`, result);
  if (result.memoTx) console.log(`Arc memo payment: ${EXPLORER}/tx/${result.memoTx}`);
  console.log(`${user.name}: balance now $${toUsd((await totalsFor(db, user.id)).balance)}`);
} else {
  console.log("Usage: npm run payout -- <email> <amount> arc|base_sepolia | verify <txHash> <payoutId> | list <email>");
}
