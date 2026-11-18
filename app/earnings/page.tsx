import { CircleCheck, Plus } from "lucide-react";
import { EXPLORER } from "@/lib/arc";
import { requireUser } from "@/lib/auth";
import { toUsd, totalsFor } from "@/lib/ledger";
import { cashableOf, DESTINATIONS, listPayouts, type PayoutDetail } from "@/lib/payouts";
import { db } from "@/lib/supabase/admin";
import { TOP_UP_AMOUNTS } from "@/lib/topup";
import { topUpAction } from "../actions";
import { SubmitButton } from "../submit-button";
import { Notice, usd } from "../ui/notice";
import { CashOutSheet } from "./cash-out-sheet";

export const dynamic = "force-dynamic";

const TOPUP: Record<string, [kind: "success" | "error", text: string]> = {
  ok: ["success", "Money added to your balance."],
  nofunds: ["error", "Your account doesn't have enough test funds yet. Open “Account details” below to add some."],
  failed: ["error", "That didn't work. Please try again."],
};
const CASHOUT: Record<string, [kind: "success" | "error", text: string]> = {
  done: ["success", "Cash-out complete."],
  bridge_failed: ["error", "The money reached your account, but the transfer to the other network didn't finish. See your cash-outs below."],
};
const STATUS: Record<PayoutDetail["status"], string> = {
  sending: "Sending…",
  bridging: "Transferring…",
  done: "Done",
  bridge_failed: "In your account (transfer didn't finish)",
  failed: "Failed, money returned",
};

export default async function EarningsPage({ searchParams }: { searchParams: Promise<{ topup?: string; cashout?: string; cashout_error?: string }> }) {
  const user = await requireUser();
  const { topup, cashout, cashout_error } = await searchParams;
  const totals = await totalsFor(db, user.id);
  const payouts = await listPayouts(db, user.id);
  const { data: sales } = await db
    .from("ledger_entries")
    .select("snippet_id, amount_usd, created_at")
    .eq("user_id", user.id)
    .eq("kind", "sale")
    .order("created_at", { ascending: false })
    .limit(200);
  const ids = [...new Set((sales ?? []).map((s) => s.snippet_id))];
  const { data: titles } = ids.length ? await db.from("snippets").select("id, title").in("id", ids) : { data: [] };
  const titleOf = new Map((titles ?? []).map((t) => [t.id, t.title]));
  // Group repeat uses of the same section: "used 4× · +$0.004", newest first.
  const grouped = new Map<string, { title: string; count: number; total: number; last: string }>();
  for (const s of sales ?? []) {
    const g = grouped.get(s.snippet_id) ?? { title: titleOf.get(s.snippet_id) ?? "A section", count: 0, total: 0, last: s.created_at };
    g.count++;
    g.total += Number(s.amount_usd);
    grouped.set(s.snippet_id, g);
  }
  const uses = [...grouped.values()].slice(0, 8);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Earnings</h1>
      {topup && TOPUP[topup] && <Notice kind={TOPUP[topup][0]}>{TOPUP[topup][1]}</Notice>}
      {cashout && CASHOUT[cashout] && <Notice kind={CASHOUT[cashout][0]}>{CASHOUT[cashout][1]}</Notice>}
      {cashout_error && <Notice kind="error">{cashout_error}</Notice>}

      <section className="grid grid-cols-3 gap-3">
        <Stat label="Earned" value={usd(toUsd(totals.earnings))} hint="from your study guides" />
        <Stat label="Balance" value={usd(toUsd(totals.balance))} hint="pays for questions" />
        <Stat label="Can cash out" value={usd(toUsd(cashableOf(totals)))} hint="what you earned" />
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="text-lg font-bold">Use your earnings</h2>
        <CashOutSheet cashable={usd(toUsd(cashableOf(totals)))} minArc={DESTINATIONS.arc.minUsd} minBase={DESTINATIONS.base_sepolia.minUsd} />
      </section>

      {payouts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Cash-outs</h2>
          <ul className="card divide-y divide-black/5">
            {payouts.map((p) => (
              <li key={p.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{usd(p.amountUsd)} to your crypto wallet</div>
                    <div className="text-xs text-black/50">{new Date(p.createdAt).toLocaleDateString()} · {STATUS[p.detail.status]}</div>
                  </div>
                  {p.detail.onchain && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      <CircleCheck size={13} aria-hidden /> Confirmed
                    </span>
                  )}
                </div>
                <details className="mt-1 text-xs text-black/50">
                  <summary className="cursor-pointer">Details</summary>
                  <div className="mt-1 space-y-0.5">
                    <p>Network: {DESTINATIONS[p.detail.destination].label}. Payout ID {p.detail.payoutId} (written on chain with the payment)</p>
                    {p.detail.memoTx && (
                      <p>
                        Payment on Arc: <a className="underline" href={`${DESTINATIONS.arc.explorer}${p.detail.memoTx}`} target="_blank">view</a>
                        {p.detail.memoVerified ? " · checked on chain" : ""}
                      </p>
                    )}
                    {p.detail.bridgedUsd && <p>Sent {usd(p.detail.bridgedUsd)} through Circle CCTP; fees about {usd(p.detail.feesUsd ?? 0)}</p>}
                    {p.detail.bridgeSteps?.filter((s) => s.url).map((s) => (
                      <p key={s.name}>{s.name}: <a className="underline" href={s.url} target="_blank">view</a></p>
                    ))}
                    {p.detail.onchain && <p>Confirmed by an independent {p.detail.onchain.by} watching Arc ({new Date(p.detail.onchain.at).toLocaleString()})</p>}
                    {p.detail.error && <p>Problem: {p.detail.error}</p>}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(sales ?? []).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">How your guides are used</h2>
          <ul className="card divide-y divide-black/5">
            {uses.map((g) => (
              <li key={g.title + g.last} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate">{g.title}</div>
                  <div className="text-xs text-black/45">Used {g.count}× · last {timeAgo(g.last)}</div>
                </div>
                <span className="shrink-0 font-semibold text-emerald-700">+{usd(g.total)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Plus size={18} aria-hidden /> Add money</h2>
        <p className="text-sm text-black/55">For more questions after your free ones. Each question costs at most $0.01.</p>
        <form action={topUpAction} className="flex flex-wrap gap-2">
          {TOP_UP_AMOUNTS.map((a) => (
            <SubmitButton key={a} name="amount" value={a} pendingText="Adding…" className="btn-secondary">Add {usd(a)}</SubmitButton>
          ))}
        </form>
        <details className="text-xs text-black/50">
          <summary className="cursor-pointer">Account details</summary>
          <p className="mt-1">
            Your money is held in a Circle wallet on the Arc test network:{" "}
            <a className="break-all font-mono underline" href={`${EXPLORER}/address/${user.walletAddress}`} target="_blank">{user.walletAddress}</a>.
            Testnet only: get free test USDC at <a className="underline" href="https://faucet.circle.com" target="_blank">faucet.circle.com</a> (Arc Testnet), then add money.
          </p>
        </details>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-black/50">{label}</div>
      <div className="text-xl font-extrabold tracking-tight md:text-2xl">{value}</div>
      <div className="text-xs text-black/45">{hint}</div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}
