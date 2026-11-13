/**
 * Fill the database with demo data: two users (one per role), the vendor
 * allowlist, and category budgets. Safe to run more than once: anything that
 * already exists is skipped or updated, never duplicated.
 *
 * Run: npm run seed
 *
 * The demo password is random, saved to .env as DEMO_PASSWORD (gitignored),
 * and never printed.
 */
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "../lib/circle.js";

// Server-only client with the secret key (can create users and bypass RLS).
const db = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false },
});

// --- 1. Demo password: reuse the one in .env, or make a new one and save it ---
let password = process.env.DEMO_PASSWORD;
if (!password) {
  password = randomBytes(12).toString("base64url");
  writeFileSync(".env", readFileSync(".env", "utf8").trimEnd() + `\nDEMO_PASSWORD=${password}\n`);
  console.log("Created DEMO_PASSWORD in .env");
}

// --- 2. Users: Alice submits invoices, Bob approves them ---
const users = [
  { email: "alice@example.com", full_name: "Alice Chen", role: "submitter" },
  { email: "bob@example.com", full_name: "Bob Okafor", role: "approver" },
];

const { data: existing, error: listError } = await db.auth.admin.listUsers();
if (listError) throw listError;

for (const u of users) {
  let id = existing.users.find((x) => x.email === u.email)?.id;
  if (!id) {
    // email_confirm: true = no confirmation email needed (demo accounts).
    const { data, error } = await db.auth.admin.createUser({ email: u.email, password, email_confirm: true });
    if (error) throw error;
    id = data.user.id;
    console.log(`Created user ${u.email}`);
  }
  // The role lives in OUR profiles table, which only the server can write.
  const { error } = await db.from("profiles").upsert({ id, email: u.email, full_name: u.full_name, role: u.role });
  if (error) throw error;
  console.log(`Profile: ${u.full_name} (${u.role})`);
}

// --- 3. Vendor allowlist: the ONLY source of payout addresses ---
const vendors = [
  {
    name: "Lumen Design GmbH",
    country: "Germany",
    payout_currency: "EURC",
    payout_address: "0xf6da3aba99f59b17b8551bec378a03c590811476",
    category: "design",
  },
  {
    name: "Northwind Dev Co.",
    country: "Canada",
    payout_currency: "USDC",
    payout_address: "0x2873aea0b837d5ec9fb3a9aa8dc55c7967f32e00",
    category: "engineering",
  },
];
{
  const { error } = await db.from("vendors").upsert(vendors, { onConflict: "name" });
  if (error) throw error;
  console.log(`Vendors: ${vendors.map((v) => v.name).join(", ")}`);
}

// --- 4. Monthly budgets per category (tiny, to fit our testnet treasury) ---
{
  const budgets = [
    { category: "design", monthly_limit_usd: 10 },
    { category: "engineering", monthly_limit_usd: 10 },
  ];
  const { error } = await db.from("budgets").upsert(budgets);
  if (error) throw error;
  console.log(`Budgets: ${budgets.map((b) => `${b.category} $${b.monthly_limit_usd}`).join(", ")}`);
}

console.log("\nSeed done. Log in as alice@example.com or bob@example.com (password: DEMO_PASSWORD in .env).");
