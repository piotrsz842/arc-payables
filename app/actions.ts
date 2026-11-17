"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { CashOutError, cashOut, isDestination } from "@/lib/payouts";
import { NotEnoughFundsError, topUp } from "@/lib/topup";

export async function topUpAction(formData: FormData) {
  const user = await requireUser();
  const amount = String(formData.get("amount"));
  try {
    await topUp(db, user, amount);
  } catch (err) {
    console.error("Top-up failed:", err);
    redirect(err instanceof NotEnoughFundsError ? "/?topup=nofunds" : "/?topup=failed");
  }
  redirect(`/?topup=ok`);
}

export async function cashOutAction(formData: FormData) {
  const user = await requireUser();
  const destination = String(formData.get("destination"));
  const amount = String(formData.get("amount") ?? "");
  let outcome: string;
  try {
    if (!isDestination(destination)) throw new CashOutError("Please choose where to send the money.");
    const result = await cashOut(db, user, amount, destination);
    outcome = `cashout=${result.status}`;
  } catch (err) {
    console.error("Cash-out failed:", err);
    const message = err instanceof CashOutError ? err.message : "That didn't work. Your balance was not changed.";
    outcome = `cashout_error=${encodeURIComponent(message)}`;
  }
  redirect(`/?${outcome}`);
}
