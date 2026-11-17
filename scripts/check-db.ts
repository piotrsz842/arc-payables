/**
 * Sanity check for Supabase:
 *   - with the SECRET key (our server), every table should be readable;
 *   - with the PUBLISHABLE key (what a browser has), every table should be
 *     invisible (0 rows), proving Row Level Security locks the data.
 *
 * Run: npm run check-db
 */
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "../lib/circle.js";

const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const opts = { auth: { persistSession: false } };
const server = createClient(url, requireEnv("SUPABASE_SECRET_KEY"), opts);
const browser = createClient(url, requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), opts);

for (const table of ["profiles", "vendors", "budgets", "invoices", "audit_log", "agent_runs", "purchase_decisions"]) {
  const s = await server.from(table).select("*", { count: "exact", head: true });
  const b = await browser.from(table).select("*").limit(1);
  const serverSees = s.error ? `ERROR ${s.error.message}` : `${s.count} rows`;
  const browserSees = b.error ? `ERROR ${b.error.message}` : `${b.data.length} rows`;
  console.log(`${table.padEnd(10)} server: ${serverSees.padEnd(10)} browser: ${browserSees}`);
}
