"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
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
