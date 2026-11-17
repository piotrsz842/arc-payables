import Link from "next/link";
import { EXPLORER } from "@/lib/arc";
import { requireUser } from "@/lib/auth";
import { toMicro, toUsd, totalsFor } from "@/lib/ledger";
import { db } from "@/lib/supabase/admin";
import { DESTINATIONS, listPayouts, type PayoutDetail } from "@/lib/payouts";
import { TOP_UP_AMOUNTS } from "@/lib/topup";
import { cashOutAction, topUpAction } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // a cash-out to Base Sepolia waits for the bridge

const money = (micro: bigint) => `$${Number(toUsd(micro)).toFixed(3)}`;

const TOPUP_MESSAGES: Record<string, string> = {
  ok: "Money added to your balance.",
  nofunds: "Your account doesn't have enough test funds yet. Open “details” below to add some.",
  failed: "That didn't work. Please try again.",
};

const CASHOUT_MESSAGES: Record<string, string> = {
  done: "Cash-out complete.",
  bridge_failed: "The money reached your account, but the transfer to the other network didn't finish. See your cash-outs below.",
};

// Plain words for each payout status.
const STATUS_WORDS: Record<PayoutDetail["status"], string> = {
  sending: "sending…",
  bridging: "transferring…",
  done: "done",
  bridge_failed: "in your account (transfer didn't finish)",
  failed: "failed, money returned",
};

export default async function Home({ searchParams }: { searchParams: Promise<{ uploaded?: string; topup?: string; cashout?: string; cashout_error?: string }> }) {
  const user = await requireUser();
  const { uploaded, topup, cashout, cashout_error } = await searchParams;
  const totals = await totalsFor(db, user.id);
  const payouts = await listPayouts(db, user.id);

  // Earnings per note: sales rows → snippet → note.
  const { data: notes } = await db.from("notes").select("id, course, title, created_at").eq("author_id", user.id).order("created_at");
  const { data: snippets } = await db.from("snippets").select("id, note_id").eq("author_id", user.id);
  const { data: sales } = await db.from("ledger_entries").select("snippet_id, amount_usd").eq("user_id", user.id).eq("kind", "sale");
  const noteOf = new Map((snippets ?? []).map((s) => [s.id, s.note_id]));
  const earnedByNote = new Map<string, bigint>();
  const soldByNote = new Map<string, number>();
  for (const sale of sales ?? []) {
    const noteId = noteOf.get(sale.snippet_id);
    if (!noteId) continue;
    earnedByNote.set(noteId, (earnedByNote.get(noteId) ?? 0n) + toMicro(sale.amount_usd));
    soldByNote.set(noteId, (soldByNote.get(noteId) ?? 0) + 1);
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Hi {user.displayName}</h1>
      {uploaded && <p className="rounded bg-green-50 p-3 text-sm text-green-800">Notes uploaded: {uploaded} sections are now available to the tutor.</p>}
      {topup && <p className="rounded bg-slate-100 p-3 text-sm">{TOPUP_MESSAGES[topup]}</p>}
      {cashout && <p className="rounded bg-green-50 p-3 text-sm text-green-800">{CASHOUT_MESSAGES[cashout]}</p>}
      {cashout_error && <p className="rounded bg-red-50 p-3 text-sm text-red-800">{cashout_error}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Your balance" value={money(totals.balance)} hint="Spend it on questions or cash it out" />
        <Stat label="Earned from your notes" value={money(totals.earnings)} hint="Every time the tutor uses them" />
        <Stat label="Free questions left" value={String(user.freeQuestionsLeft)} hint="Then questions use your balance" />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/ask" className="rounded bg-slate-900 px-4 py-2 font-medium text-white">Ask the tutor</Link>
        <Link href="/notes/new" className="rounded border px-4 py-2 font-medium">Upload notes</Link>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Your notes</h2>
        {(notes ?? []).length === 0 && <p className="text-sm text-slate-500">No notes yet. Upload a study guide to start earning.</p>}
        <ul className="divide-y rounded border bg-white">
          {(notes ?? []).map((n) => (
            <li key={n.id} className="flex justify-between p-3 text-sm">
              <span><span className="font-medium">{n.course}</span> · {n.title}</span>
              <span>
                {soldByNote.get(n.id) ?? 0} {soldByNote.get(n.id) === 1 ? "use" : "uses"} · earned {money(earnedByNote.get(n.id) ?? 0n)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Add money</h2>
        <form action={topUpAction} className="flex flex-wrap gap-2">
          {TOP_UP_AMOUNTS.map((a) => (
            <button key={a} name="amount" value={a} className="rounded border bg-white px-4 py-2 text-sm">Add ${a}</button>
          ))}
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Cash out</h2>
        <form action={cashOutAction} className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="block text-slate-500">Amount ($)</span>
            <input name="amount" inputMode="decimal" placeholder="0.25" required className="w-28 rounded border px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="block text-slate-500">Send to</span>
            <select name="destination" className="rounded border bg-white px-3 py-2">
              {Object.entries(DESTINATIONS).map(([key, d]) => (
                <option key={key} value={key}>
                  {d.label} (min ${d.minUsd}{key === "base_sepolia" ? ", transfer fees apply" : ""})
                </option>
              ))}
            </select>
          </label>
          <button className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">Cash out</button>
        </form>
        {payouts.length > 0 && (
          <ul className="divide-y rounded border bg-white text-sm">
            {payouts.map((p) => (
              <li key={p.id} className="p-3">
                <div className="flex justify-between">
                  <span>{new Date(p.createdAt).toLocaleDateString()} · ${Number(p.amountUsd).toFixed(3)} to {DESTINATIONS[p.detail.destination].label}</span>
                  <span>{STATUS_WORDS[p.detail.status]}</span>
                </div>
                <details className="mt-1 text-xs text-slate-500">
                  <summary className="cursor-pointer">details</summary>
                  <p>Payout ID {p.detail.payoutId} (written on chain with the payment)</p>
                  {p.detail.memoTx && (
                    <p>
                      Payment on Arc:{" "}
                      <a className="underline" href={`${DESTINATIONS.arc.explorer}${p.detail.memoTx}`} target="_blank">view</a>
                      {p.detail.memoVerified ? " · checked on chain" : ""}
                    </p>
                  )}
                  {p.detail.bridgedUsd && <p>Sent ${p.detail.bridgedUsd} through Circle CCTP; fees about ${p.detail.feesUsd}</p>}
                  {p.detail.bridgeSteps?.filter((s) => s.url).map((s) => (
                    <p key={s.name}>
                      {s.name}: <a className="underline" href={s.url} target="_blank">view</a>
                    </p>
                  ))}
                  {p.detail.error && <p>Problem: {p.detail.error}</p>}
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="rounded border bg-white p-3 text-sm text-slate-600">
        <summary className="cursor-pointer">Details</summary>
        <p className="mt-2">
          Your money is held in a Circle wallet on the Arc test network:{" "}
          <a className="font-mono underline" href={`${EXPLORER}/address/${user.walletAddress}`} target="_blank">{user.walletAddress}</a>
        </p>
        <p className="mt-1">
          Testnet only: get free test USDC for that address at{" "}
          <a className="underline" href="https://faucet.circle.com" target="_blank">faucet.circle.com</a> (choose Arc Testnet), then use “Add money”.
        </p>
      </details>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-3xl font-semibold">{value}</div>
      <div className="text-xs text-slate-400">{hint}</div>
    </div>
  );
}
