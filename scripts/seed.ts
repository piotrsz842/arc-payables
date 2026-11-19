/**
 * Demo data. Safe to run more than once (existing things are reused).
 *
 *   - removes the old project's demo logins (alice/bob)
 *   - "Demo Notes" author: the 5 Stage 2 demo snippets, same ids (demo-1..5)
 *   - "Sam Student": a demo student whose wallet gets a little test USDC
 *     from the platform wallet, so "Add money" can be tried
 *
 * Every account gets a real Circle wallet on Arc testnet, like a real signup.
 * Password for all demo accounts = DEMO_PASSWORD in .env (generated if empty, never printed).
 *
 * Run: npm run seed
 */
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Address } from "viem";
import { BLOCKCHAIN, USDC_ADDRESS, usdcBalance } from "../lib/arc.js";
import { circle, requireEnv, waitForTransaction } from "../lib/circle.js";
import { createUserWallet } from "../lib/wallets.js";
import { priceSection, wordCount } from "../lib/pricing.js";
import { DEMO_SNIPPETS } from "./demo-data.js";

const db = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false },
});

let password = process.env.DEMO_PASSWORD;
if (!password) {
  password = randomBytes(12).toString("base64url");
  writeFileSync(".env", readFileSync(".env", "utf8").trimEnd() + `\nDEMO_PASSWORD=${password}\n`);
  console.log("Created DEMO_PASSWORD in .env");
}

const { data: list, error: listError } = await db.auth.admin.listUsers();
if (listError) throw listError;

// 1. The old accounts-payable demo users.
for (const email of ["alice@example.com", "bob@example.com"]) {
  const old = list.users.find((u) => u.email === email);
  if (old) {
    await db.auth.admin.deleteUser(old.id);
    console.log(`Removed old demo user ${email}`);
  }
}

/** A login + profile + Circle wallet, reusing whatever already exists. */
async function ensureUser(email: string, displayName: string) {
  let id = list.users.find((u) => u.email === email)?.id;
  if (!id) {
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    id = data.user.id;
  }
  const { data: existing } = await db.from("profiles").select("*").eq("id", id).maybeSingle();
  if (existing) return existing;
  const wallet = await createUserWallet();
  const { data, error } = await db
    .from("profiles")
    .insert({ id, email, display_name: displayName, wallet_id: wallet.id, wallet_address: wallet.address })
    .select()
    .single();
  if (error) throw error;
  console.log(`Created ${displayName} <${email}> with a wallet on Arc`);
  return data;
}

// 2. The Stage 2 demo author and snippets.
const demoAuthor = await ensureUser("demo-notes@example.com", "Demo Notes");
for (const course of [...new Set(DEMO_SNIPPETS.map((s) => s.course))]) {
  const title = `Checker demo notes (${course})`;
  let { data: note } = await db.from("notes").select("id").eq("author_id", demoAuthor.id).eq("title", title).maybeSingle();
  const inCourse = DEMO_SNIPPETS.filter((s) => s.course === course);
  if (!note) {
    const res = await db
      .from("notes")
      .insert({ author_id: demoAuthor.id, course, title, body: inCourse.map((s) => s.content).join("\n\n") })
      .select("id")
      .single();
    if (res.error) throw res.error;
    note = res.data;
  }
  const { error } = await db.from("snippets").upsert(
    inCourse.map((s, i) => ({
      id: s.id,
      note_id: note.id,
      author_id: demoAuthor.id,
      position: i,
      course: s.course,
      title: s.title,
      summary: s.summary,
      content: s.content,
      price_usd: priceSection(wordCount(s.content)).usd, // platform price, like every section
    })),
  );
  if (error) throw error;
}
console.log(`Demo snippets: ${DEMO_SNIPPETS.map((s) => s.id).join(", ")}`);

// 3. A demo student with a little test money in their wallet.
const sam = await ensureUser("sam@example.com", "Sam Student");
const samHas = Number(await usdcBalance(sam.wallet_address as Address));
if (samHas < 0.5) {
  console.log(`Sending Sam 1 test USDC from the platform wallet (has $${samHas})...`);
  const res = await circle.createTransaction({
    blockchain: BLOCKCHAIN,
    walletAddress: requireEnv("TREASURY_WALLET_ADDRESS"),
    tokenAddress: USDC_ADDRESS,
    destinationAddress: sam.wallet_address,
    amount: ["1"],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  const result = await waitForTransaction(res.data!.id!);
  console.log(`  ${result.state}`);
}

console.log("\nSeed done. Demo logins: sam@example.com, demo-notes@example.com (password: DEMO_PASSWORD in .env).");
