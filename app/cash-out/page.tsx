import Link from "next/link";
import { cashOutAction } from "@/app/actions";
import { SubmitButton } from "@/app/submit-button";
import { requireUser } from "@/lib/auth";
import { CashOutError, DESTINATIONS, isDestination, quoteCashOut } from "@/lib/payouts";
import { db } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // the confirmed cash-out runs from this page; Base Sepolia waits for the bridge

const usd = (v: string) => `$${Number(v).toFixed(3)}`;

/** Confirm screen: what the author pays in fees and what arrives, before any money moves. */
export default async function ConfirmCashOut({ searchParams }: { searchParams: Promise<{ amount?: string; to?: string }> }) {
  const user = await requireUser();
  const { amount = "", to = "" } = await searchParams;

  let quote: Awaited<ReturnType<typeof quoteCashOut>> | null = null;
  let problem: string | null = null;
  if (!isDestination(to)) problem = "Please choose where to send the money.";
  else {
    try {
      quote = await quoteCashOut(db, user, amount, to);
    } catch (err) {
      problem = err instanceof CashOutError ? err.message : "We couldn't work out the fees right now. Please try again.";
      if (!(err instanceof CashOutError)) console.error("Cash-out quote failed:", err);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-lg border bg-white p-6">
      <h1 className="text-xl font-bold">Confirm cash-out</h1>
      {problem || !quote || !isDestination(to) ? (
        <>
          <p className="rounded bg-red-50 p-3 text-sm text-red-800">{problem}</p>
          <Link href="/" className="inline-block text-sm underline">Back to your dashboard</Link>
        </>
      ) : (
        <>
          <table className="w-full text-sm">
            <tbody>
              <tr><td className="py-1 text-slate-500">From your balance</td><td className="text-right">{usd(quote.amountUsd)}</td></tr>
              <tr>
                <td className="py-1 text-slate-500">{to === "arc" ? "Fees (we cover them)" : "Estimated transfer fees"}</td>
                <td className="text-right">−{usd(quote.feesUsd)}</td>
              </tr>
              <tr className="border-t font-semibold">
                <td className="py-2">Arrives in your account on {DESTINATIONS[to].label}</td>
                <td className="text-right">{to === "arc" ? "" : "about "}{usd(quote.receiveUsd)}</td>
              </tr>
            </tbody>
          </table>
          {to === "base_sepolia" && (
            <p className="text-xs text-slate-500">
              Moving money to another network has fees we don&apos;t control (network costs and Circle&apos;s relay). They&apos;re
              estimated right now and can change slightly. Takes about 30 seconds.
            </p>
          )}
          <form action={cashOutAction} className="flex gap-2">
            <input type="hidden" name="amount" value={quote.amountUsd} />
            <input type="hidden" name="destination" value={to} />
            <SubmitButton pendingText={to === "arc" ? "Sending…" : "Sending… (about 30 s)"}>Confirm cash-out</SubmitButton>
            <Link href="/" className="rounded border px-4 py-2">Cancel</Link>
          </form>
        </>
      )}
    </div>
  );
}
