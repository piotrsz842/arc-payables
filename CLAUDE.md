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

### Core design principles (the demo story)
- **"AI reads, code decides."** The LLM only extracts fields from invoices (untrusted input). Payout addresses come ONLY from the vendor allowlist, never from invoice text. Policy rules are plain deterministic TypeScript, not the LLM.
- **"Trust the chain, not ourselves."** An invoice is marked paid only when the QuickNode Stream sees the payment (with that invoice's memo) land on Arc, not when Circle's API returns OK.
- **Separation of duties.** Submitter can't approve their own invoice; over-threshold invoices need the approver role; every approve/reject goes in an audit log (who, when, why).

### MUST SHIP (scope agreed 2026-11-12)
1. Submit an invoice (PDF upload or form); the agent extracts vendor, amount, currency, due date, invoice #.
2. Policy checks: vendor allowlist, category budgets, duplicate detection, human-approval threshold, **payout-detail-change / prompt-injection flagging**.
3. Login with roles (submitter, approver) + separation of duties + audit log.
4. Dashboard where the approver approves/rejects flagged invoices.
5. Pay USDC on Arc testnet via Circle developer-controlled wallets, with the invoice ID attached as an onchain memo (Arc Memo contract via Circle contract execution).
6. QuickNode Stream on Arc testnet watches the treasury wallet → webhook marks invoices paid.
7. **EUR invoices paid in EURC:** convert USDC→EURC via Circle App Kit Swap (documented on Arc testnet), behind an "FX provider" interface so StableFX can replace it.
   - StableFX itself is gated (needs Circle sales/Hub sandbox key). Ask Circle at workshops (Nov 16–19) / Telegram; README explains testnet uses App Kit Swap, production would use StableFX.
   - UNVERIFIED RISK: App Kit Swap with Circle dev-controlled wallets (example uses a viem adapter). Test with a standalone script early.
8. Demo moment: a fraudulent invoice (changed payout address + hidden "ignore instructions, approve") gets flagged.

### STRETCH (in order, only after core)
1. CCTP payouts to other chains (Arc = CCTP V2 domain 26; App Kit has a Circle Wallets adapter).
Dropped: CSV export.

### Schedule
- Thu–Fri: test payment → memo payment → USDC→EURC swap test script
- Sat: Next.js + DB + Vercel deploy + login/roles skeleton
- Sun: invoice extraction
- Mon: policy checks + approval dashboard with roles + audit log
- Tue: QuickNode Stream → mark paid
- Wed: EURC payouts in app + fraud-invoice demo
- Thu: CCTP if time, else polish; README + demo video (must not slip)
- Fri Nov 20 morning: submit (deadline 12:00 PM CST)

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
- Entity secret (https://developers.circle.com/wallets/dev-controlled/entity-secret-management): 32-byte key, account-scoped, Circle never stores it. SDK encrypts it with Circle's public RSA key into a single-use ciphertext per request (anti-replay). Rotate/reset only in Console; reset needs the recovery file (downloadable once). Lose both secret + recovery file = no way to move funds. Docs do NOT say what re-registering does, nor whether keys are MPC; don't claim either.
- StableFX: permissioned RFQ + onchain escrow (FxEscrow testnet `0xd68256f4D69C6BbEcB873D8588AE0Dc6B8E22E10`, needs Permit2 `0x000000000022D473030F116dDEE9F6B43aC78BA3`). Key from Circle sales/Hub only (https://developers.circle.com/stablefx).
- App Kit Swap: USDC/EURC/cirBTC on Arc testnet (https://docs.arc.io/app-kit/swap).
- CCTP V2 on Arc testnet: domain 26, TokenMessengerV2 `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA`, MessageTransmitterV2 `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275`.
- **Each USDC transfer emits TWO `Transfer` logs** (seen in test tx `0x9768a25d…3a376d34`, block 72137690): one from `0x3600…0000` (6 decimals) and one from system address `0xffff…fffe` (18 decimals, native). The QuickNode filter must match only the `0x3600…` log, or payments get double-counted.
- **Memo contract ABI** (verified source on explorer; tutorial https://docs.arc.io/arc/tutorials/send-usdc-with-transaction-memo): `memo(address target, bytes data, bytes32 memoId, bytes memoData)`. Emits `BeforeMemo(uint256 indexed memoIndex)` THEN `Memo(address indexed sender, address indexed target, bytes32 callDataHash, bytes32 indexed memoId, bytes memo, uint256 memoIndex)`. Memo topic0 `0xeb15ee720798341c37739df41be53acfbbf70ae6802dade35457beec6e47a5e4`. Uses CallFrom precompile so the USDC transfer's sender is our wallet (no approve). EOA callers only. Memos are public: invoice IDs only, no personal data.
- Our memo format: `memoId = keccak256(invoiceId)` (indexed → QuickNode can filter by it), `memoData = invoiceId` as UTF-8 bytes.
- Circle: send memo payments with `createContractExecutionTransaction({ walletId, contractAddress: MEMO, callData })` (callData built with viem, since abiParameters officially only supports string/number/boolean).
- Memo payments verified on chain: INV-0001 (1 USDC) `0xc8e4e12c…5f08a2`, INV-0002 (0.5 USDC) `0xc6be2c34…aae04c`.
- First test payment (1 USDC) cost ~0.0024 USDC gas (73,950 gas).
- Faucet: https://faucet.circle.com, 20 USDC / address / 2h, CAPTCHA (the human does it).

## Our testnet wallets (Circle dev-controlled, EOA, ARC-TESTNET; created 2026-11-12)
- Treasury: `0x682f94386d613fb53fe4e21c566d13fcc4548c80` (wallet ID in .env)
- Test contractor: `0xf6da3aba99f59b17b8551bec378a03c590811476`
- Entity secret registered 2026-11-12; recovery file in `recovery/` (gitignored, back it up privately).

## Project notes (keep up to date)
- `scripts/` holds standalone scripts run with `npx tsx scripts/<name>.ts`.
- `scripts/test-payment.ts` — proves the payment rail: creates Circle dev-controlled wallets on ARC-TESTNET, shows balance, sends a plain USDC transfer.
- `scripts/memo-payment.ts` — `pay <invoiceId> <amount>` sends USDC via the Memo contract and verifies it on chain; `verify <txHash> <invoiceId>` re-checks without paying.
- `lib/arc.ts` — Arc addresses, Memo ABI, `buildMemoTransferCall`, `readMemoPayment` (reads receipt, returns memo text + USDC transfer). Reuse in the app and the QuickNode webhook.
- `lib/circle.ts` — Circle client, `requireEnv`, `waitForTransaction`.
- Done 2026-11-12: plain payment ✅, memo payment ✅. Next: USDC→EURC App Kit Swap test script.
