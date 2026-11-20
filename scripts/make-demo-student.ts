/**
 * A fresh student account for the demo video: owns nothing yet, 3 free
 * questions, approval setting $0.002, and a small balance.
 *
 *   npm run make-demo-student -- "<Name>"     (login <name-slug>@example.com, password DEMO_PASSWORD)
 *
 * Fund its wallet first (testnet USDC), e.g. npm run pay -- send 0.25 <address>;
 * the script then tops up $0.10 the same way the Add money button does.
 * Re-running for the same name only tops up again.
 */
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "../lib/circle.js";
import { totalsFor, toUsd } from "../lib/ledger.js";
import { topUp } from "../lib/topup.js";
import { createUserWallet } from "../lib/wallets.js";

const name = process.argv[2];
if (!name) throw new Error('Usage: npm run make-demo-student -- "<Name>"');
const db = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false },
});
const email = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}@example.com`;

const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
let id = list?.users.find((u) => u.email === email)?.id;
if (!id) {
  const { data, error } = await db.auth.admin.createUser({ email, password: requireEnv("DEMO_PASSWORD"), email_confirm: true });
  if (error) throw error;
  id = data.user.id;
}
let { data: profile } = await db.from("profiles").select("wallet_id, wallet_address").eq("id", id).maybeSingle();
if (!profile) {
  const wallet = await createUserWallet();
  const { error } = await db.from("profiles").insert({
    id, email, display_name: name, wallet_id: wallet.id, wallet_address: wallet.address, approval_threshold_usd: "0.002",
  });
  if (error) throw error;
  profile = { wallet_id: wallet.id, wallet_address: wallet.address };
  console.log(`Created ${name} <${email}>, approval setting $0.002, wallet ${wallet.address}`);
}

if (process.argv.includes("--topup")) {
  const tx = await topUp(db, { id, walletId: profile.wallet_id, walletAddress: profile.wallet_address }, "0.10");
  console.log(`Topped up $0.10 (deposit tx ${tx})`);
}
const totals = await totalsFor(db, id);
console.log(`${name}: balance ${toUsd(totals.balance)}`);
