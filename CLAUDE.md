# CLAUDE.md — arc-payables

## Who I'm working with
- Solo builder, CS freshman with limited coding experience.
- **Explain what you're doing as you go, keep things simple, and check they understand each piece.**
- They must be the primary creator and be able to answer judges' questions about every part of the code. Prefer small, readable code over clever code. No large unexplained dumps.

## Hackathon
- UBC 2026 Hackathon (rules: `docs/Hackathon Guide UBC 26.docx`).
- **Submission deadline: Fri Nov 20, 2026, 12:00 PM CST.** Judging/demos Sat Nov 21 (must attend in person to win any prize).
- Entering: **Agentic Payments & AI** (main track) + **Best use of Arc** (chain award) + **QuickNode Streams** bounty.
- Arc judges want something end-to-end that solves a real problem, not superficial.
- Submission needs: public GitHub repo with setup instructions, working demo/deployed app, 2–3 min demo video, README with architecture overview, written Devpost answers (what / problem / how / unique / next).

## Project
An AI accounts-payable agent that pays international contractors in USDC on Arc (Circle's stablecoin L1, testnet).

### MUST SHIP (in order)
1. Submit an invoice (PDF upload or form); the agent extracts vendor, amount, due date, invoice #.
2. Policy checks: vendor allowlist, category budgets, duplicate detection, human-approval threshold.
3. Dashboard where the user approves/rejects flagged invoices.
4. Pay USDC on Arc testnet via Circle developer-controlled wallets, with the invoice ID attached as an onchain memo.
5. QuickNode Stream on Arc testnet watches the treasury wallet → webhook marks invoices paid.

### STRETCH (only if core is done by Tue Nov 17)
EURC payouts via StableFX, CCTP payouts to other chains, CSV export.

### Stack
Next.js + TypeScript (one repo), Postgres (Neon or Supabase), Circle Wallets SDK, viem, an LLM API for invoice extraction, deployed on Vercel.

### README must include
- Architecture overview
- The agent's decision loop and safety limits (required by the Agentic track)
- How the project uses Arc + all contract addresses used (required by Best use of Arc)
- How the QuickNode Stream is configured: network, dataset, filter, destination, and why (required by the bounty)

## Rules for us
- **Never commit `.env` or secrets.** Only `.env.example` with blank placeholders.
- Small, frequent git commits with clear messages.
- Verify Circle / Arc / QuickNode details against their current docs instead of guessing. Note the doc URL when you rely on a fact.

## Verified facts (checked against docs 2026-11-12)
- Arc docs moved to **docs.arc.io**. Testnet chain ID `5042002`, RPC `https://rpc.testnet.arc.io`, explorer `https://explorer.testnet.arc.io`.
- USDC is Arc's gas token. Native balance = 18 decimals; USDC ERC-20 interface `0x3600000000000000000000000000000000000000` = 6 decimals.
- EURC testnet: `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`.
- **Memo contract** (testnet): `0x5294E9927c3306DcBaDb03fe70b92e01cCede505`. It attaches memo metadata to contract calls and emits `Memo` events. Plain Circle `createTransaction` transfers have NO memo field, so must-ship #4 must go through Circle's contract-execution API calling this contract. Read its ABI before building that.
- Circle Node SDK: `@circle-fin/developer-controlled-wallets` (needs Node 22.18+). Blockchain ID `ARC-TESTNET`. Circle `refId` is offchain metadata only.
- Faucet: https://faucet.circle.com, 20 USDC / address / 2h, CAPTCHA (the human does it).

## Our testnet wallets (Circle dev-controlled, EOA, ARC-TESTNET; created 2026-11-12)
- Treasury: `0x682f94386d613fb53fe4e21c566d13fcc4548c80` (wallet ID in .env)
- Test contractor: `0xf6da3aba99f59b17b8551bec378a03c590811476`
- Entity secret registered 2026-11-12; recovery file in `recovery/` (gitignored, back it up privately).

## Project notes (keep up to date)
- `scripts/` holds standalone scripts run with `npx tsx scripts/<name>.ts`.
- `scripts/test-payment.ts` — proves the payment rail: creates a Circle dev-controlled wallet on ARC-TESTNET and sends a small USDC transfer.
