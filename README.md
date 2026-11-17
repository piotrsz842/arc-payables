# Notes by Students (working name)

Students write great notes and get nothing, while AI tutors don't know their specific course. **We pay students when an AI tutor uses their notes**, and the agent must justify every purchase before it spends.

Built for the UBC 2026 Hackathon on **Arc testnet** (Circle's stablecoin L1) with Circle Gateway Nanopayments, x402, Wallets, CCTP and Arc's Memo extension.

> 🚧 Work in progress. This project pivoted on 2026-11-16 from an accounts-payable agent; some old code is still being replaced. The full README (architecture, the agent's decision loop and safety limits, contract addresses, what is simulated) comes before submission.

## Run it locally
Requires Node.js 22.18+.

```bash
npm install
cp .env.example .env   # then fill in the values (see comments in the file)
npm run dev            # http://localhost:3000
```

Database: create a Supabase project and run `supabase/schema.sql` in its SQL Editor.
