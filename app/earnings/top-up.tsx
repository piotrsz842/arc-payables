"use client";

import { useState } from "react";
import { SubmitButton } from "@/app/submit-button";
import { usd } from "@/app/ui/notice";
import { topUpAction } from "../actions";

/** Pick an amount, then confirm or cancel. Nothing moves until Confirm. */
export function TopUp({ amounts }: { amounts: string[] }) {
  const [amount, setAmount] = useState<string | null>(null);

  if (!amount) {
    return (
      <div className="flex flex-wrap gap-2">
        {amounts.map((a) => (
          <button key={a} type="button" onClick={() => setAmount(a)} className="btn-secondary">
            Add {usd(a)}
          </button>
        ))}
      </div>
    );
  }
  return (
    <form action={topUpAction} className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
      <p className="text-sm">
        Add <strong>{usd(amount)}</strong> to your balance from your account? It pays for future questions.
      </p>
      <input type="hidden" name="amount" value={amount} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingText="Adding…" className="btn-primary">Add {usd(amount)}</SubmitButton>
        <button type="button" onClick={() => setAmount(null)} className="btn-secondary">Cancel</button>
      </div>
    </form>
  );
}
