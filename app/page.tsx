import Link from "next/link";
import { EXPLORER } from "@/lib/arc";
import { requireUser } from "@/lib/auth";
import { toMicro, toUsd, totalsFor } from "@/lib/ledger";
import { db } from "@/lib/supabase/admin";
import { TOP_UP_AMOUNTS } from "@/lib/topup";
import { topUpAction } from "./actions";

export const dynamic = "force-dynamic";

const money = (micro: bigint) => `$${Number(toUsd(micro)).toFixed(3)}`;

const TOPUP_MESSAGES: Record<string, string> = {
  ok: "Money added to your balance.",
  nofunds: "Your account doesn't have enough test funds yet. Open “details” below to add some.",
  failed: "That didn't work. Please try again.",
};

export default async function Home({ searchParams }: { searchParams: Promise<{ uploaded?: string; topup?: string }> }) {
  const user = await requireUser();
  const { uploaded, topup } = await searchParams;
  const totals = await totalsFor(db, user.id);

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
              <span>{soldByNote.get(n.id) ?? 0} uses · earned {money(earnedByNote.get(n.id) ?? 0n)}</span>
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
