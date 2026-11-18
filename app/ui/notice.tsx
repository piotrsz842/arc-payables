import { CheckCircle2, Info, XCircle } from "lucide-react";

/** A clear success / info / error message at the top of a page. */
export function Notice({ kind = "success", children }: { kind?: "success" | "info" | "error"; children: React.ReactNode }) {
  const styles = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    info: "border-brand-100 bg-brand-50 text-brand-900",
    error: "border-red-200 bg-red-50 text-red-900",
  }[kind];
  const Icon = { success: CheckCircle2, info: Info, error: XCircle }[kind];
  return (
    <div role="status" className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${styles}`}>
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

/** Dollars, always, without hiding fractions of a cent: $0.013, $0.27, $1.24, $0 (not $0.000). */
export function usd(value: number | string): string {
  const n = Number(value);
  if (n === 0) return "$0";
  if (Math.abs(n) >= 10) return `$${n.toFixed(2)}`;
  const s = n.toFixed(3);
  return `$${s.endsWith("0") ? s.slice(0, -1) : s}`;
}
