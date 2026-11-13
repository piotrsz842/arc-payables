# Arc Payables

An AI accounts-payable agent that pays international contractors in **USDC and EURC on Arc testnet** (Circle's stablecoin L1), built for the UBC 2026 Hackathon.

> 🚧 Work in progress. The full README (architecture, the agent's decision loop and safety limits, Arc contract addresses, QuickNode Stream configuration) is coming before submission.

## What works so far
- **Payments:** USDC payouts from a Circle developer-controlled treasury wallet on Arc testnet, with the invoice reference attached through Arc's Memo contract and verified by reading the chain.
- **FX:** USDC → EURC conversion through Circle App Kit Swap.
- **App:** a Next.js app with Supabase login and roles (submitter / approver), and a treasury balance read live from Arc.

## Run it locally
Requires Node.js 22.18+.

```bash
npm install
cp .env.example .env   # then fill in the values (see comments in the file)
npm run seed           # demo users, vendors, budgets (needs Supabase set up)
npm run dev            # http://localhost:3000
```

Database: create a Supabase project and run `supabase/schema.sql` in its SQL Editor.

## Useful scripts
| Command | What it does |
|---|---|
| `npm run pay -- balance` | Treasury balances from Circle |
| `npm run memo-pay -- pay <ref> <amount>` | Pay with an onchain memo, then verify it on Arc |
| `npm run swap -- estimate <usdc>` | Quote a USDC → EURC swap |
| `npm run check-db` | Show that the browser key can't read any table (RLS) |
