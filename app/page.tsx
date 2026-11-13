import type { Address } from "viem";
import { eurcBalance, EXPLORER, usdcBalance } from "@/lib/arc";
import { requireUser } from "@/lib/auth";

// This is a Server Component: it runs on our server, never in the browser,
// so it can read server-only settings like the treasury address from .env.
// Re-render on every request so balances are always fresh.
export const dynamic = "force-dynamic";

export default async function Home() {
  await requireUser(); // must be logged in (any role)
  const treasury = process.env.TREASURY_WALLET_ADDRESS as Address;

  // "Trust the chain": read balances directly from Arc, not from Circle.
  const [usdc, eurc] = await Promise.all([usdcBalance(treasury), eurcBalance(treasury)]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Treasury</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Balance label="USDC" amount={usdc} />
        <Balance label="EURC" amount={eurc} />
      </div>
      <p className="text-sm text-slate-500">
        Wallet{" "}
        <a className="font-mono underline" href={`${EXPLORER}/address/${treasury}`} target="_blank">
          {treasury}
        </a>{" "}
        on Arc testnet. Balances are read live from the chain.
      </p>
    </div>
  );
}

// A small reusable box showing one balance.
function Balance({ label, amount }: { label: string; amount: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-3xl font-semibold">{Number(amount).toFixed(2)}</div>
    </div>
  );
}
