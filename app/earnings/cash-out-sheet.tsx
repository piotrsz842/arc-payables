"use client";

import { Building2, Check, ChevronDown, GraduationCap, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/**
 * Cash-out options, in plain words. Chain names only appear under "Advanced".
 *   1. Use for tutoring (earnings already pay for your questions)
 *   2. Bank account: coming soon (needs a payout partner; not simulated)
 *   3. Advanced → send to a crypto wallet (Arc or Base Sepolia)
 */
export function CashOutSheet({ cashable, minArc, minBase }: { cashable: string; minArc: string; minBase: string }) {
  const [choice, setChoice] = useState<"tutoring" | "wallet">("tutoring");
  const [advanced, setAdvanced] = useState(false);

  return (
    <div className="space-y-3">
      <Option selected={choice === "tutoring"} onClick={() => setChoice("tutoring")} icon={GraduationCap} title="Use for tutoring" subtitle="Your earnings pay for your own questions">
        {choice === "tutoring" && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-black/60">
            Nothing to do: your earnings are already in your balance and pay for questions automatically.
            <Link href="/ask" className="btn-primary px-3 py-2">Ask a question</Link>
          </div>
        )}
      </Option>

      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-black/10 bg-black/[0.015] p-4 text-black/45" aria-disabled>
        <Building2 size={20} className="mt-0.5 shrink-0" aria-hidden />
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">Bank account</span>
            <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold">Coming soon</span>
          </div>
          <div className="text-sm">Bank payouts arrive with a payout partner.</div>
        </div>
      </div>

      <button type="button" onClick={() => setAdvanced((a) => !a)} className="flex items-center gap-1 text-sm font-medium text-black/55 hover:text-ink" aria-expanded={advanced}>
        Advanced <ChevronDown size={16} className={`transition ${advanced ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {advanced && (
        <Option selected={choice === "wallet"} onClick={() => setChoice("wallet")} icon={Wallet} title="Send to a crypto wallet" subtitle={`USDC to your own wallet. You can send up to ${cashable}.`}>
          {choice === "wallet" && (
            <form action="/cash-out" method="get" className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
              <label className="block text-sm">
                <span className="mb-1 block text-black/60">Amount (USD)</span>
                <input name="amount" inputMode="decimal" required placeholder={minArc} className="field max-w-40" />
              </label>
              <fieldset className="space-y-2 text-sm">
                <legend className="mb-1 text-black/60">Network</legend>
                <label className="flex items-center gap-2"><input type="radio" name="to" value="arc" defaultChecked /> Arc · no fee · minimum ${minArc}</label>
                <label className="flex items-center gap-2"><input type="radio" name="to" value="base_sepolia" /> Base Sepolia · transfer fee about $0.08 · minimum ${minBase}</label>
              </fieldset>
              <button className="btn-primary">Review</button>
              <p className="text-xs text-black/45">You'll see the exact fee and what arrives before anything is sent.</p>
            </form>
          )}
        </Option>
      )}
    </div>
  );
}

function Option({ selected, onClick, icon: Icon, title, subtitle, children }: {
  selected: boolean; onClick: () => void; icon: typeof Wallet; title: string; subtitle: string; children?: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      className={`cursor-pointer rounded-2xl border bg-white p-4 transition ${selected ? "border-brand-500 ring-4 ring-brand-100" : "border-black/10 hover:border-black/20"}`}
    >
      <div className="flex items-start gap-3">
        <Icon size={20} className={`mt-0.5 shrink-0 ${selected ? "text-brand-600" : "text-black/50"}`} aria-hidden />
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">{title}</span>
            {selected && <Check size={18} className="text-brand-600" aria-hidden />}
          </div>
          <div className="text-sm text-black/55">{subtitle}</div>
          {children}
        </div>
      </div>
    </div>
  );
}
