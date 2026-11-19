/**
 * Checks that pressing Stop never charges: asks one real question as a LOCAL
 * test account, aborts it as soon as the tutor starts checking a section, then
 * reads the database: run charged $0, no spend entry, free questions unchanged.
 * Costs one partial tutor call (well under $0.01). localhost only.
 *
 *   npm run test-stop -- [email]
 * Password comes from TEST_SIGNUP2_PASSWORD (.env); never printed.
 */
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";
import { requireEnv } from "../lib/circle.js";

const email = process.argv[2] ?? "test-author-2@example.com";
const base = "http://localhost:3000";
const password = process.env.TEST_SIGNUP2_PASSWORD;
if (!password) throw new Error("TEST_SIGNUP2_PASSWORD missing in .env");
const db = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), { auth: { persistSession: false } });

const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
const userId = users.users.find((u) => u.email === email)?.id;
if (!userId) throw new Error(`No user ${email}`);
const profile = async () => (await db.from("profiles").select("free_questions_left").eq("id", userId).single()).data!;
const balance = async () => {
  const { data } = await db.from("ledger_entries").select("amount_usd").eq("user_id", userId);
  return (data ?? []).reduce((s, r) => s + Number(r.amount_usd), 0);
};

const before = { free: (await profile()).free_questions_left, balance: await balance() };

const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const page = await browser.newPage();
await page.goto(`${base}/login`);
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', password);
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click('button:has-text("Sign in")')]);

// Ask, and abort the moment the tutor proposes its first purchase (or after 8 s).
const seen = await page.evaluate(async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const events: string[] = [];
  try {
    const res = await fetch("/api/ask", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "How does open addressing handle collisions in a hash table?" }), signal: controller.signal,
    });
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      for (const line of value.split("\n").filter(Boolean)) {
        const type = JSON.parse(line).type as string;
        events.push(type);
        if (type === "checking") controller.abort();
      }
    }
  } catch {
    /* aborted */
  }
  clearTimeout(timer);
  return events;
});
await browser.close();
console.log("events before Stop:", seen.join(", ") || "(none)");

// Give the server a moment to notice and finish the run.
let run: { status: string; charged_usd: string; answer: string | null; id: string } | null = null;
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  const { data } = await db.from("agent_runs").select("id, status, charged_usd, answer").eq("asked_by", userId).order("created_at", { ascending: false }).limit(1).single();
  run = data;
  if (run && run.status !== "running") break;
}
const after = { free: (await profile()).free_questions_left, balance: await balance() };
const { data: spends } = await db.from("ledger_entries").select("amount_usd").eq("user_id", userId).eq("kind", "spend").eq("run_id", run?.id ?? "00000000-0000-0000-0000-000000000000");
console.log("run:", run?.status, "charged", run?.charged_usd, "|", run?.answer);
console.log(`free questions ${before.free} → ${after.free}, balance ${before.balance} → ${after.balance}, spend rows for run: ${spends?.length ?? 0}`);
const ok = run?.status !== "running" && Number(run?.charged_usd) === 0 && after.free === before.free && after.balance === before.balance;
console.log(ok ? "PASS: stopped, nothing charged" : "FAIL");
process.exit(ok ? 0 : 1);
