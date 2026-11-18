import Link from "next/link";
import { redirect } from "next/navigation";
import { cashOutAction } from "@/app/actions";
import { SubmitButton } from "@/app/submit-button";
import { usd } from "@/app/ui/notice";
import { requireUser } from "@/lib/auth";
import { CashOutError, DESTINATIONS, isDestination, quoteCashOut } from "@/lib/payouts";
import { db } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // the confirmed cash-out runs from this page; Base Sepolia waits for the bridge

/** Confirm screen: what the author pays in fees and what arrives, before any money moves. */
export default async function ConfirmCashOut({ searchParams }: { searchParams: Promise<{ amount?: string; to?: string }> }) {
  const user = await requireUser();
  const { amount = "", to = "" } = await searchParams;
  const back = (message: string) => redirect(`/earnings?cashout_error=${encodeURIComponent(message)}`);
  if (!isDestination(to)) back("Please choose where to send the money.");
  const destination = to as keyof typeof DESTINATIONS;

  let quote: Awaited<ReturnType<typeof quoteCashOut>>;
  try {
    quote = await quoteCashOut(db, user, amount, destination);
  } catch (err) {
    if (!(err instanceof CashOutError)) console.error("Cash-out quote failed:", err);
    back(err instanceof CashOutError ? err.message : "We couldn't work out the fees right now. Please try again.");
    return null;
  }

  return (
    <div className="card mx-auto max-w-md space-y-5 p-6">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">Send to your crypto wallet</h1>
        <p className="text-sm text-black/55">Network: {DESTINATIONS[destination].label}</p>
      </div>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between"><dt className="text-black/55">From your earnings</dt><dd>{usd(quote.amountUsd)}</dd></div>
        <div className="flex justify-between">
          <dt className="text-black/55">{destination === "arc" ? "Fees (we cover them)" : "Estimated transfer fees"}</dt>
          <dd>−{usd(quote.feesUsd)}</dd>
        </div>
        <div className="flex justify-between border-t border-black/5 pt-2 text-base font-bold">
          <dt>You receive</dt>
          <dd>{destination === "arc" ? "" : "about "}{usd(quote.receiveUsd)}</dd>
        </div>
      </dl>
      {destination === "base_sepolia" && (
        <p className="text-xs text-black/50">
          Moving money to another network has fees we don&apos;t control (network costs and Circle&apos;s relay). They&apos;re estimated now and can
          change slightly. Takes about 30 seconds.
        </p>
      )}
      <form action={cashOutAction} className="flex gap-2">
        <input type="hidden" name="amount" value={quote.amountUsd} />
        <input type="hidden" name="destination" value={destination} />
        <SubmitButton pendingText={destination === "arc" ? "Sending…" : "Sending… (about 30 s)"} className="btn-primary flex-1">Confirm</SubmitButton>
        <Link href="/earnings" className="btn-secondary">Cancel</Link>
      </form>
    </div>
  );
}
