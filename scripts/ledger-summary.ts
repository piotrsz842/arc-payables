/**
 * Everyone's ledger totals (balance, earnings, spent, top-ups, payouts).
 * Run: npm run ledger
 */
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "../lib/circle.js";
import { toUsd, totalsFor } from "../lib/ledger.js";

const db = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false },
});
const { data: people } = await db.from("profiles").select("id, display_name, free_questions_left").order("created_at");
for (const p of people ?? []) {
  const t = await totalsFor(db, p.id);
  console.log(
    `${p.display_name.padEnd(16)} balance $${toUsd(t.balance).padEnd(8)} earned $${toUsd(t.earnings).padEnd(8)} ` +
      `spent $${toUsd(t.spent).padEnd(8)} topped up $${toUsd(t.toppedUp).padEnd(6)} paid out $${toUsd(t.paidOut).padEnd(6)} free Qs ${p.free_questions_left}`,
  );
}
