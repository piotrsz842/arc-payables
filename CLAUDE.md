# CLAUDE.md — Notes by Students (`notes-by-students`, working name)

## Who I'm working with
- Solo builder, CS freshman, still learning.
- **Explain what you're doing as you go, keep things simple, and check they understand each piece.** They must be able to answer judges' questions about every part of the code.
- Prefer small, readable code over clever code. No large unexplained dumps.

## Hackathon
- UBC 2026 Hackathon (rules: `docs/Hackathon Guide UBC 26.docx`, kept local, not committed).
- **Feature freeze: Wed Nov 18, night. Submission deadline: Fri Nov 20, 2026, 12:00 PM CST.** Judging/demos Sat Nov 21 (in person).
- Entering: **Agentic Payments & AI** track + **Best use of Arc**. QuickNode Streams bounty only if time allows.
- Submission: public GitHub repo with setup instructions, deployed app, 2–3 min demo video, README, Devpost answers.
- Pivoted on 2026-11-16 from "arc-payables" (AI accounts-payable agent). Old brief is in git history.

## What Circle/Arc said at office hours (design to this)
- End-to-end projects that solve a real problem, not superficial ones.
- Deeper use of Arc and Circle protocols, not just sending USDC. They named **CCTP** and **Gateway**.
- Problems students actually have, with **crypto hidden from everyday users**.

## The project
**Pitch:** Students write great notes and get nothing, while AI tutors don't know their specific course. We pay students when AI uses their notes, and the agent must justify every purchase before it spends.

### Roles
- **Authors:** students who upload study guides they wrote.
- **Tutor agent:** an AI with a small USDC budget that answers course questions.
- **Platform:** sells note snippets over x402, checks each purchase, pays authors.

### Flow
1. Author signs up with email. We create a Circle wallet on Arc testnet behind the scenes (no seed phrase, no wallet setup, no gas token). They upload a note; it is split into snippets, each priced at a fraction of a cent, with a free preview (title, course, one-line summary).
2. A user asks the tutor a course question.
3. The agent searches free previews and proposes snippets to buy, with a reason for each.
4. **CHECKER** runs before any payment as a separate step. It sees ONLY the question, the preview, the reason, and the budget, never the agent's other context. It asks: relevant? budget left? duplicate? is the agent looping? Result: **allow / block / ask human**.
5. Agent pays for allowed snippets over **x402** using **Circle Gateway Nanopayments** on Arc. The agent's budget is a Gateway balance.
6. The sale is recorded; the author's earnings go up on their dashboard immediately, in dollars.
7. Agent answers, citing which notes it used, what it spent, and what was blocked and why.
8. Author clicks **Cash out** and picks a destination: stay on Arc, or one other testnet chain via **CCTP**. Each payout carries its payout ID onchain via Arc's **Memo** extension. Explorer link sits behind a "details" toggle.

### Additions (added 2026-11-16; build in Stage 3, not before)
1. **Spendable earnings.** An author's earnings balance can pay for their own tutor questions, not just be cashed out. A student who uploads notes may never need to pay. Pitch line: **"Your notes pay for your tutoring."**
2. **Free starter questions.** New users get a small number of free questions before needing a balance. Students who want more top up a small amount, shown in dollars.

### Hide the crypto (author and student screens)
Email signup, dollar amounts, plain words ("earnings", "cash out"). No addresses, chain names or token names on main screens, except the cash-out destination dropdown. Technical details go behind "details".

### Build order (each stage must work before the next starts)
1. **Stage 1 (riskiest, first, ~3h time-box):** standalone script: a buyer with a Gateway balance pays an x402-paywalled endpoint on Arc testnet via Gateway Nanopayments. Fallbacks in order: (a) Circle's hosted x402 Facilitator Service (docs say it supports Arc testnet), (b) last resort only: hand-written x402-style flow with a verified USDC transfer (Circle said plain sending is not enough).
2. **Stage 2:** checker + budget in front of that payment, decision log in the DB. Include one deliberately irrelevant snippet and a looping scenario so a block can be demoed.
3. **Stage 3:** email signup + wallet creation, note upload + snippet storage, tutor agent, sales ledger, author earnings, plus the two additions below (spendable earnings, free starter questions).
4. **Stage 4:** cash-out on Arc with a Memo, then CCTP cash-out to one other testnet chain.
5. **Stage 5:** UI: upload page, tutor chat showing purchases/blocks live, author dashboard, "ask human" approval prompt.
6. **Stage 6:** deploy to Vercel, seed 3–4 demo authors with notes the user writes, end-to-end test.
- **If later stages run short, Stages 1–2 alone must still be a complete, demoable project.**

### Remaining plan (from the user, 2026-11-17; replaces the old stretch list)
**Stage 6 (Tue Nov 17), after the live-site test:**
- Seed data: the user writes the notes for a course they're taking. 3–4 demo author accounts. Include one deliberately irrelevant note so the checker has something to block.
- **Outside agent:** a separate script with NO account on our platform that finds a snippet (free `GET /api/snippets`) and buys it over x402 (`/api/snippets/[id]`) like any outside AI agent would. Demo point: why x402 matters (any agent can buy our notes, not just our tutor). The sale still credits the author.
- Run the full flow end to end on the live site after seeding.

- Outside agent: BUILT 2026-11-18 (`scripts/outside-agent.ts`, own key `OUTSIDE_AGENT_PRIVATE_KEY`, imports none of our code). Bought demo-3 from the LIVE site in 1.4 s; author credited.

**Wednesday Nov 18 plan (from the user; replaces the earlier extras list). FEATURE FREEZE 11 PM CST tonight; after that bug fixes only.**

Part A, must-haves, in order:
1. Close the money loop (Arc wants end-to-end):
   a. Top-ups auto-deposit into the agent's Gateway balance (no manual script).
   b. Cash-outs funded by the platform's Gateway income, not faucet money: move Gateway balance → platform wallet before/as part of each cash-out (check Circle's current docs; tell the user if unsupported on Arc testnet).
2. Checker tuning: on-topic notes allowed without an "unsure" prompt; only the off-topic note blocked; only the premium note asks for approval. Demo flow must be predictable.
3. Premium note: optional `Price:` field in the seed format so one note costs $0.008 and triggers approval by price.
4. Cash-out fees: before confirming a Base Sepolia cash-out, show the estimated fee and the amount that will arrive, in dollars. Sensible minimum for cross-chain cash-outs.
5. Signup protection: simple rate limit on signup (every signup creates a real Circle wallet).
After Part A: full flow end to end, commit, push, deploy, and **tell the user it's done before starting Part B.**

Part B, extras, in order, each time-boxed 2 h:
6. pgvector search on snippets, filtered by course first, combined with the keyword search.
7. ERC-8004 agent identity on Arc testnet for the tutor (Arc tutorial); record allowed/blocked purchases toward its reputation if feasible.
8. QuickNode Stream on Arc testnet watching the platform wallet: filter USDC transfers out (cash-outs), webhook to our API marks the cash-out "confirmed onchain". The user creates the account + Stream from exact settings we give.
Rules for Part B: commit + push before each extra (rollback point); each must not break Part A (rerun the full flow after each); not working by its time-box → stop, revert, explain, move on; anything unfinished at 11 PM → reverted and listed under "What's next".

README additions: "Known limitations" stated honestly (raw agent key, ledger-based author payouts, Base Sepolia funds not usable in-app, no memo on the CCTP leg, approval-timeout budget behavior). If pgvector isn't finished, describe it in the scaling section. If the QuickNode Stream is built, document network, dataset, filter, destination, and why (bounty requirement).

**Thursday: submission materials**
- README (see below).
- Help plan a 2–3 min demo video script showing: a purchase, a blocked purchase, the outside agent, and a cash-out.
- Help rehearse the 5-min pitch and likely judge questions. **The user writes the Devpost answers and pitch in their own words; we only review them.**

**Ongoing:** walk the user through the codebase piece by piece so they can explain every part to judges. Start with the payment flow and the checker.

### README must include
- Architecture diagram/overview.
- The agent's decision loop and safety limits (checker, budget, loop detection, human approval).
- Every Circle protocol used (Gateway Nanopayments, x402, Wallets, CCTP via App Kit, Memo, any others) and why each.
- Every contract address used.
- Setup instructions.
- What is simulated (testnet funds, seeded notes).
- A **"Why x402"** section.
- A **scaling** section: storage, pgvector search filtered by course, batched settlement, checker cost, moderation.
- **What's next:** platform fee per purchase to cover AI model costs, direct per-purchase author payouts, reputation.

## Rules for us
- **Never commit `.env` or secrets.** The user enters keys themselves. Only `.env.example` with blank placeholders.
- Small, frequent commits with clear messages; push after each working stage.
- Verify Circle / Arc / x402 details against current docs instead of guessing; note the doc URL; **say when something is unverified**.
- Keep it simple. **No new features beyond this brief without asking.**

## Stack (carried over)
Next.js 16 (App Router) + React 19 + Tailwind 4 + TypeScript 7, Supabase (Postgres + Auth), Circle developer-controlled wallets SDK, Circle App Kit (bridge), `@circle-fin/x402-batching` (Gateway Nanopayments), viem, Claude API (`@anthropic-ai/sdk`) for the tutor + checker, deployed on Vercel.

### App security model (explain to judges)
- The browser never queries the database. Every table has RLS ON with NO policies, so the publishable key can't read anything.
- Supabase Auth = WHO you are. Our server code = WHAT you may do (checks `profiles.role`), then queries with the server-only `SUPABASE_SECRET_KEY`.
- Server-side, verify the user with `supabase.auth.getClaims()`. NEVER trust `getSession()` on the server.
- Next.js 16: the session-refresh file is `proxy.ts` (was `middleware.ts`). x402 API routes must be excluded from its login redirect.
- Only `NEXT_PUBLIC_*` env vars reach the browser (Supabase URL + publishable key). Everything else is server-only.
- Known: `npm audit` flags `elliptic` (via ethers v5 inside Circle packages). We don't sign with it. Mention under known limitations.

## Verified facts
### Arc (checked 2026-11-12, re-checked 2026-11-16, docs.arc.io)
- Testnet chain ID `5042002` (CAIP-2 `eip155:5042002`), RPC `https://rpc.testnet.arc.io`, explorer `https://explorer.testnet.arc.io`. (Circle's nanopayments sample uses `https://rpc.testnet.arc.network`; UNVERIFIED which is preferred, both may work.)
- USDC is the gas token. Native balance = 18 decimals; USDC ERC-20 at `0x3600000000000000000000000000000000000000` = 6 decimals. Never add the two balance views together.
- **Each USDC transfer emits TWO `Transfer` logs**: from `0x3600…0000` (6 dec) and from `0xffff…fffe` (18 dec, native). Only count the `0x3600…` one.
- **Memo contract** `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` (listed under "Transaction extensions" on https://docs.arc.io/arc/references/contract-addresses for testnet and mainnet). `memo(address target, bytes data, bytes32 memoId, bytes memoData)`; emits `BeforeMemo` then `Memo(sender, target, callDataHash, memoId indexed, memo, memoIndex)`. Uses CallFrom so the transfer's sender is our wallet. **EOA callers only.** Memos are public: IDs only, never names/emails.
- Our memo format: `memoId = keccak256(payoutId)`, `memoData = payoutId` as UTF-8.
- Send memo payments via Circle `createContractExecutionTransaction({ walletId, contractAddress: MEMO, callData })` with callData built by viem (`lib/arc.ts`). Verified working 2026-11-12.
- CCTP V2 on Arc testnet: domain 26, TokenMessengerV2 `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA`, MessageTransmitterV2 `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275`.
- ERC-8004 (stretch) testnet: IdentityRegistry `0x8004A818BFB912233c491871b3d84c89A494BD9e`, ReputationRegistry `0x8004B663056A597Dffe9eCcC1965A193B7388713`, ValidationRegistry `0x8004Cb1BF31DAf7788923b405b754f57acEB4272`. Tutorial: https://docs.arc.io/arc/tutorials/register-your-first-ai-agent
- Faucet: https://faucet.circle.com (CAPTCHA, the human does it).

### Circle Wallets (checked 2026-11-12)
- SDK `@circle-fin/developer-controlled-wallets` (Node 22.18+). Blockchain ID `ARC-TESTNET`. `refId` is offchain metadata only.
- Entity secret: 32-byte key, Circle never stores it; SDK encrypts it per request. Rotate/reset only in Console; reset needs the recovery file (`recovery/`, gitignored). Don't claim MPC or what re-registering does (docs don't say).
- Wallets are EOA (needed for Memo).

### Gateway Nanopayments + x402 (read 2026-11-16, https://developers.circle.com/gateway/nanopayments)
- Arc testnet supported. `GatewayClient` chain name `"arcTestnet"`; network `eip155:5042002`; Gateway domain 26.
- Testnet GatewayWallet `0x0077777d7EBA4688BDeF3E311b846F25870A19B9`, GatewayMinter `0x0022222ABE238Cc2C7Bb1f21003F0a260052475B`. Gateway testnet API / facilitator URL `https://gateway-api-testnet.circle.com`.
- Buyer: `new GatewayClient({ chain, privateKey })` from `@circle-fin/x402-batching/client`; `deposit("1")`, `getBalances()` (`.gateway.available`), `pay(url, { method, body })`, `withdraw(amount, { chain?, recipient? })`. **Documented GatewayClient needs a raw private key.** The buyer quickstart also has a Circle Wallets tab using `circle.signTypedData` + contract execution for approve/deposit (custom signer path).
- Seller: `createGatewayMiddleware({ sellerAddress, facilitatorUrl })` (Express), or `BatchFacilitatorClient` from `@circle-fin/x402-batching/server` with `verify()` then `settle()` (Circle's Next.js sample `circlefin/arc-nanopayments`, `lib/x402.ts`). Requirements: `scheme: "exact"`, `asset` = USDC, amount in 6-decimal units, `extra: { name: "GatewayWalletBatched", version: "1", verifyingContract: GatewayWallet }`. Headers: 402 + `PAYMENT-REQUIRED`; buyer retries with `payment-signature`; response `PAYMENT-RESPONSE`.
- Payments as small as $0.000001; offchain payments cost no gas. Deposit/approve/withdraw cost gas (USDC on Arc).
- Docs disagree on `validBefore` (7 days vs 3 days): use 7+.
- Circle's hosted **Facilitator Service** (fallback a) settles each payment onchain via a Circle relayer; supports Arc (incl. `upto` on Arc testnet). Needs a Circle API key. URL/fees not yet read.
- **VERSION WARNING:** npm has `@circle-fin/x402-batching` **4.0.0** (2026-10-22); docs/sample show 2.x–3.x. Read the installed package's `.d.ts` before relying on doc snippets. `@x402/core` / `@x402/evm` are 2.31.0.
- **Read from the 4.0.0 `.d.ts` itself (2026-11-16):**
  - `GatewayClientConfig = { chain, privateKey, rpcUrl?, headers?, token? }`: raw key only, no custom signer. Methods: `deposit(amount)`, `depositFor(amount, depositor)`, `getBalances()` → `{ wallet, gateway: { total, available, withdrawing, withdrawable, formatted* } }`, `supports(url)`, `pay(url, { method, body, headers })` → `{ data, amount, formattedAmount, transaction, status }`, `withdraw(amount, { chain?, recipient?, maxFee? })` (default maxFee 2.01 USDC).
  - `GatewayClient` has x402 lifecycle hooks: `onBeforePaymentCreation(ctx)` can return `{ abort: true, reason }` (a last-line spending guard), `onAfterPaymentCreation`, `onPaymentResponse`.
  - Custom signer path: `BatchEvmScheme({ address, signTypedData })` (used by the docs' Circle Wallets tab with `circle.signTypedData`).
  - **`BatchFacilitatorClient` and `createGatewayMiddleware` DEFAULT TO MAINNET (`https://gateway-api.circle.com`).** Always pass `url` / `facilitatorUrl: "https://gateway-api-testnet.circle.com"`. Circle's sample calls `new BatchFacilitatorClient()` with no URL; don't copy that.
  - New in 4.x: EIP-712 batching `extra.version` "1" or "2" (v2 adds `salt` = asset address, binding the signature to the token). Buyer signs either.
  - SDK's own Arc testnet RPC default: `https://rpc.testnet.arc.network`.
  - Also ships `createFacilitatorMiddleware` / `CircleFacilitatorClient` (fallback a: Circle Facilitator Service, `https://api.circle.com/v1/facilitator/x402`, settles each payment onchain, needs a seller-signed `Facilitator-Seller-Proof` header).
  - `createGatewayMiddleware` is Express-only. For Next.js route handlers, call `BatchFacilitatorClient.settle(payload, requirements)` ourselves (pattern from `circlefin/arc-nanopayments` `lib/x402.ts`). Docs say settle() alone is enough (no verify first).
  - Seller returns as soon as Gateway accepts; the onchain batch settles later ("often several minutes").
  - **`@circle-fin/x402-batching/server` imports `@x402/evm` at runtime** despite it being "optional": install it.
- **Stage 1 results (2026-11-16, this repo):**
  - Deposit of 1 USDC (approve + deposit, ~0.003 USDC gas) became `available` in Gateway within ~1 minute on Arc testnet.
  - `agent.pay()` round trip ~230–250 ms; buyer's Gateway `available` drops immediately; buyer's wallet pays no gas.
  - `settle().transaction` is a **Circle transfer UUID**, not a tx hash (e.g. `8c8575ce-6ccb-4587-ba19-cf388d2bfd3d`).
  - Seller's Gateway balance does NOT rise at accept time; it rises when Gateway settles the batch. So "author earnings go up immediately" must come from OUR ledger (recorded at settle-accept), not from reading Gateway.
  - Forged signature → Gateway refuses (`success: false`, no `errorReason` given).
  - Batch settlement observed: the platform's Gateway balance went 0 → 0.003 USDC (3 purchases) ~7 min after the first purchase.

### App Kit Bridge / CCTP (read 2026-11-16, https://docs.arc.io/app-kit/quickstarts/bridge-tokens-across-blockchains)
- `@circle-fin/app-kit` + `@circle-fin/adapter-circle-wallets` (already installed; swap tested with our wallets 2026-11-13). Lighter alternative: `@circle-fin/bridge-kit`.
- `kit.bridge({ from: { adapter, chain: "Arc_Testnet", address }, to: { adapter, chain: "Ethereum_Sepolia", address }, amount })`. Chain strings are case-sensitive. `Ethereum_Sepolia` is shown in the docs; `Base_Sepolia` is NOT confirmed there.
- Recipient: RECONCILED 2026-11-17 from the installed `@circle-fin/bridge-kit` 1.17.2 README/QUICKSTART/.d.ts: `to.recipientAddress` is the recipient; `to.address` is the adapter-context address.
- Bridging from Arc: amount must exceed the CCTP v2 max fee or burn reverts ("Max fee must be less than amount"). So enforce a minimum cash-out.
- **Forwarder** (same source): `to: { chain, recipientAddress, useForwarder: true }` with NO destination adapter. Circle's relayer fetches the attestation and mints; its fee is taken from the minted USDC. The kit only checks `forwarderSupported.destination` (Base/Ethereum/Arbitrum Sepolia = true). `kit.estimateBridge` returns `fees[]` (kit/provider/forwarder) and `gasFees[]` per step. `BridgeResult.steps[]` = approve, burn, fetchAttestation, mint (each with `txHash`, `explorerUrl`). OP_Sepolia is not a CCTP bridge chain in the kit.
- **Measured estimates 2026-11-17** (Arc → X, FAST, forwarder): Ethereum_Sepolia forwarder fee **$1.33**, Base_Sepolia **$0.053**, Arbitrum_Sepolia $0.084; Arc gas for approve + burn ~$0.032. → We use **Base Sepolia**.

## Our testnet wallets (Circle dev-controlled, EOA, ARC-TESTNET)
- Platform treasury (was "Treasury"): `0x682f94386d613fb53fe4e21c566d13fcc4548c80` (wallet ID in .env). ~16.4 USDC on 2026-11-16.
- Old contractor wallets `0xf6da…1476`, `0x2873…2e00`: leftover from the old project, not used.
- Machine check 2026-11-16 (new laptop): `npm run pay -- send 0.01` COMPLETE, tx `0xe22cf580…50a8`.

## Deploy
- GitHub https://github.com/piotrsz842/notes-by-students (renamed from `arc-payables` 2026-11-16; GitHub redirects the old URL). Public; push to `main` auto-deploys to Vercel. Live: https://arc-payables-chi.vercel.app (Vercel project still named `arc-payables`; the user renames it in the dashboard, and the URL may or may not change). Verified 2026-11-16: Vercel's Git link followed the GitHub rename (push of fe9c442 deployed in ~21 s), and the agent bought a snippet from the live `/api/snippets/demo-1` (672 ms). `vercel.json` pins `"framework": "nextjs"`.
- Local folder is still `projecto/arc-payables`; rename it with no session/editor open in it.
- Vercel env vars: least privilege; add server keys only when a feature needs them.

## Project notes (keep up to date)
- `.env` was found named `env` (no dot, NOT gitignored) on 2026-11-16 and renamed. `.env` and `recovery/` are gitignored.
- `lib/arc.ts`: Arc constants, Memo ABI, `buildMemoTransferCall`, `readMemoPayment` (verify on chain).
- `lib/circle.ts`: Circle client, `requireEnv`, `waitForTransaction`.
- `lib/supabase/*`, `lib/auth.ts`, `proxy.ts`, `app/login/`: auth plumbing (carried over).
- `scripts/register-entity-secret.ts`, `scripts/test-payment.ts`, `scripts/memo-payment.ts`: carried over (proven rails).
- **Stage 1 code:** `lib/x402.ts` (`requirePayment(req, { priceUsd, description }, deliver)`: seller side, settles via testnet Gateway, pays to `TREASURY_WALLET_ADDRESS`), `app/api/snippets/[id]/route.ts` (2 hard-coded demo snippets at $0.001; 404 before any price), `scripts/agent-pay.ts` (`balance | deposit <usdc> | buy <id>`; `onBeforePaymentCreation` hook enforces a $0.01 per-payment cap), `scripts/make-agent-wallet.ts` (writes `AGENT_PRIVATE_KEY`/`AGENT_ADDRESS` to .env, prints address only). `npm run pay -- fund-agent <usdc>` sends platform → agent.
- `proxy.ts` matcher excludes `api/snippets` (payment-protected, not login-protected).
- `AGENTS.md` is auto-written by `next dev` (Next.js 16); committed so the tree stays clean.
- Agent wallet: `0x8361242E4D4578D6BF70C36bC65191b1F24fb994` (funded 2 USDC from platform 2026-11-16; 1 USDC deposited to Gateway).
- **Stage 2 code:**
  - `lib/checker.ts`: `checkPurchase(snippetId, input, history)` → allow / block / ask_human with a `rule`. Order (cheapest first): loop (≥6 proposals, or re-proposing a blocked snippet) → duplicate → per-snippet cap $0.01 → question budget → Gateway balance → relevance (isolated Claude call: `claude-opus-5-5`, effort low, structured output, server-side fallbacks on; sees ONLY question, preview, reason, price, budget; told preview/reason are untrusted) → approval threshold $0.005 → allow. Relevance check failing (no key, refusal, outage) → ask_human (`checker_unavailable`), never allow.
  - `lib/purchases.ts`: `startRun`, `proposePurchase` (history read from `purchase_decisions`, decision logged BEFORE paying, human answer + payment written back), `finishRun`.
  - `lib/demo-snippets.ts`: 5 demo snippets (demo-2 ECON and demo-5 BIOL = irrelevant; demo-4 = $0.008 → approval threshold). `GET /api/snippets` = free previews (no content).
  - `supabase/stage2.sql`: `agent_runs`, `purchase_decisions` (RLS on, no policies). Run by the user in the SQL Editor 2026-11-16 ✅.
  - `scripts/stage2-demo.ts` (`npm run stage2-demo [-- --human=yes|no]`): 8 scripted proposals → allow, ask_human (unsure), block relevance, duplicate, block relevance despite "ignore your rules" reason, ask_human (approval threshold), loop ×2 → run stopped. `scripts/test-checker.ts` (`npm run test-checker`): rule tests + 2 live manipulation tests (pushy reason, instruction hidden in preview) — both blocked. `scripts/decision-log.ts` (`npm run decision-log [-- all]`): prints the log and checks paid totals.
  - Observed: the relevance model often says "unsure" when a one-line preview doesn't prove coverage (e.g. demo-1). Good summaries matter in Stage 3, or real users will see many approval prompts. Order matters: budget/loop rules can block before relevance runs (by design: cheapest first).
  - Money check 2026-11-16: 3 demo runs, 9 paid proposals = $0.030 logged = agent Gateway balance 0.997 → 0.967.
- **Stage 3 code (2026-11-17):**
  - DB: `supabase/schema.sql` = full fresh schema; `supabase/migrations/002_*`, `003_*` = what the existing project ran (003 dropped the invoice tables). Tables: `profiles` (display_name, Circle `wallet_id`/`wallet_address`, `free_questions_left` default 3), `notes`, `snippets` (text id; demo ids `demo-1..5`), `agent_runs` (+ asked_by, free_question, charged_usd, answer), `purchase_decisions`, `ledger_entries` (kind sale/spend/topup/payout, signed amount; `gateway_transfer_id` UNIQUE so a sale can't be credited twice). No views (Supabase views bypass RLS unless security_invoker).
  - `lib/ledger.ts`: `totalsFor` (balance = sum; earnings = sales), `recordSale`, `recordEntry`. Money as bigint micro-dollars.
  - Signup `app/signup/`: admin `createUser` (email_confirm: true) → `lib/wallets.ts` `createUserWallet()` (EOA, ARC-TESTNET, wallet set "notes-by-students-users" found/created by name) → profile → sign in. Rolls back the login if the wallet fails.
  - Notes `lib/notes.ts`: `splitNote` (code: split at headings, ~250-word paragraph groups, lone headings (<15 words) glued to next) → `describeChunks` (Claude writes title + specific one-line summary; author text untouched) → `priceFor` ($0.001 per started 150 words, max $0.004) → `saveNote`. Course normalized to upper case. Page `app/notes/new/`.
  - `app/api/snippets/[id]`: content from DB; on Gateway accept → `recordSale` to the author (errors logged, content still delivered). `GET /api/snippets?q=&course=` previews (keyword scoring in `lib/snippets.ts`).
  - `lib/tutor.ts` `askTutor`: free question (atomic decrement) or balance (min $0.001, budget = min($0.01, balance)) → Tool Runner (`claude-opus-5-5`, effort medium, max 12 iterations, fallbacks) with `search_notes` (excludes asker's own notes) + `buy_snippet` (→ `proposePurchase` → checker) → charge `spend` from ledger total actually paid (0 if free). `getRunReceipt` builds the receipt from the DB. Web "ask human" = `"pending"` (row keeps human_decision null; agent continues without it). Approve button = Stage 5.
  - `lib/agent-wallet.ts` `getAgent()`: shared GatewayClient + $0.01 per-payment hook. `lib/topup.ts`: user's Circle wallet → AGENT_ADDRESS transfer, ledger `topup` after COMPLETE; checks wallet has amount + $0.01 gas first. Top-ups land in the agent's plain wallet; moving them into Gateway is manual (`npm run agent-pay -- deposit`).
  - Pages: `/` dashboard (balance, earnings, free Qs, notes with uses/earned, Add $0.10/$0.50/$1, Details = wallet address + faucet), `/ask`, `/ask/[runId]` (answer, notes used + why, waiting for OK, not bought + why, cost), `/signup`, `/notes/new`. `proxy.ts` lets `/signup` through.
  - Scripts: `npm run seed` (needs `--conditions=react-server` because lib/wallets imports server-only; already in package.json): removes alice/bob, creates Demo Notes (demo-1..5) + Sam Student ($1 test USDC); `npm run ask -- "q" [--as=email] [--human=yes|no|pending]`; `npm run ledger`; `npm run test-notes [-- file]`; `npm run pay -- send <amt> [address]`.
  - **`npm run typecheck` now runs `tsc --incremental false`**: TypeScript 7's incremental cache hid errors.
- **Stage 3 verified 2026-11-17** (local): seed made 2 Circle wallets; stage2-demo unchanged on DB and credited Demo Notes $0.010; tutor (CLI) bought 1 relevant snippet and cited it, flagged general-knowledge parts; browser signup "Ana Author" (ana@example.com, password = TEST_SIGNUP_PASSWORD in .env) created wallet + dashboard; uploaded TEST note "Hash tables" → 4 snippets; Sam's question bought Ana's "Load factor and resizing" → Ana earned $0.001 immediately; empty-wallet top-up → friendly message; funded → Add $0.10 → balance $0.101; out of free Qs + $0 balance → NeedsTopUp before any AI/payment; Ana asked on the web page → paid $0.001 from her balance (earnings + top-up); pending approval path works. Reconciled: agent Gateway −$0.013 = ledger sales $0.013; agent wallet +$0.10 = Ana's top-up.
- Test data to clear before Stage 6 seeding: Ana Author + "Hash tables (TEST note)"; Ana's free_questions_left was set to 0 for testing.
- **Vercel env vars** (the user enters them): CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, ANTHROPIC_API_KEY, AGENT_PRIVATE_KEY, AGENT_ADDRESS, TREASURY_WALLET_ADDRESS, TREASURY_WALLET_ID (cash-out) + Supabase vars. Optional SITE_URL. User added + redeployed 2026-11-17 (the TREASURY pair added after).
- **Stage 4 code (2026-11-17):**
  - `lib/payouts.ts` `cashOut(db, user, amountUsd, destination)`: destinations `arc` (min $0.01) and `base_sepolia` (min $0.25). No new table: a payout = ledger row kind `payout` (negative) with `detail` {payoutId "PO-xxxxxxxxxx", destination, status sending/bridging/done/bridge_failed/failed, memoTx, memoVerified, bridgeSteps, bridgedUsd, feesUsd, error}. The row is written BEFORE money moves, then the balance is re-checked, so two simultaneous cash-outs can't overspend (tested). Memo payment failure → reversal row (positive payout, `detail.reversalOf`): append-only.
  - Leg 1 (always): platform wallet (`TREASURY_WALLET_ID`) → Memo contract → USDC.transfer to the author's Arc wallet, memo = payout ID; read back from Arc with `readMemoPayment` (`memoVerified`).
  - Leg 2 (base_sepolia): the AUTHOR's Circle wallet bridges with App Kit + Circle Wallets adapter, forwarder mode, recipient = the author's same address on Base Sepolia. Fees are planned BEFORE leg 1 (`planBridge`); Arc gas for approve + burn is held back from the bridged amount (fallback $0.04 if not estimable). A bridge failure after leg 1 is NOT reversed (the money is in the author's Arc wallet) → status `bridge_failed`.
  - The CCTP burn itself carries no memo; the payout ID is on the leg-1 Arc tx, and our ledger row links both.
  - `next.config.ts` `serverExternalPackages` = app-kit + adapter only: Turbopack can't bundle the adapter (optional `@solana/kit` import). Do NOT add `@circle-fin/developer-controlled-wallets` there: that made live `/signup` 500 on Vercel (fine locally; cause unknown, no Vercel logs). `lib/payouts.ts` imports App Kit dynamically inside `planBridge`, so a load failure can only break the Base Sepolia cash-out. Live `/signup` 200 again at 2b29cd2.
  - UNVERIFIED on Vercel: cash-out itself (needs a logged-in user; the user tests it).
  - Dashboard: Cash out form (amount + destination dropdown = the only place chain names appear), cash-outs list with a "details" toggle (payout ID, Arc payment link, CCTP step links). `maxDuration = 300` on `/`.
  - Scripts: `npm run payout -- <email> <amt> arc|base_sepolia | verify <tx> <payoutId> | list <email>`, `npm run bridge-estimate -- <amt>` (no money moves). `scripts/memo-payment.ts` removed (replaced).
- **Stage 4 verified 2026-11-17** (local, test account Ana): Arc cash-out $0.02 in 7.5 s, memo read back ✓; refusals (over balance, under min, "abc", Base under min) ✓; two simultaneous $0.05 → only one paid ✓; browser Base Sepolia cash-out $0.40 in <30 s: $0.029 kept for Arc gas, $0.371 burned, forwarder fee $0.053, **$0.318004 minted to Ana's address on Base Sepolia** (read from Base Sepolia: Transfer logs + balanceOf); script Base cash-out $0.25 on the final code in 21.7 s ✓.
- **Stage 5 code (2026-11-17):**
  - `app/submit-button.tsx` `SubmitButton` (useFormStatus: disabled + spinner + pendingText) on signup, login, upload, top-up, cash-out.
  - Live tutor: `POST /api/ask` streams NDJSON `TutorEvent`s (`lib/tutor.ts`: started, search, checking, needs_approval, approval_result, bought, not_bought, answer, done; + error topup/failed). `app/ask/ask-chat.tsx` reads the stream and shows each step. Old `app/ask/actions.ts` removed. Events carry titles/prices/reasons only, never note content.
  - Ask-human on the web: `AskHuman(preview, decision, logId)`. The streaming request emits needs_approval and polls the decision log for `human_decision` (`lib/approvals.ts`, 1.5 s, up to 120 s; else "pending" = skipped). The click is `POST /api/decisions/[id]` (asker only, run still `running`, verdict ask_human, `human_decision` still null: conditional update). DB, not memory, because Vercel may run the two requests on different instances.
  - **Parallel purchases:** Claude can call buy_snippet twice at once. `proposePurchase` now runs read-history → check → log one at a time per run (in-process queue), and the budget counts money already PROMISED (paid, allowed-not-yet-paid, ask_human not denied), and duplicates include allowed-not-yet-paid. Approval waits happen outside the queue. `payForLoggedDecision` recomputes `spent_usd` from the log. stage2-demo `--human=no` re-run: same 8 verdicts ✓.
  - `/notes/[id]`: author-only page showing the sections exactly as the tutor sees them (title, preview, price, uses, earned). Upload redirects there. `saveNote` returns `{ noteId, sections }`.
  - Dashboard: note titles link to their page; "Recent sales" (last 8). Receipt page: unanswered approvals are labelled "Skipped (no answer in time)".
- **Stage 5 verified 2026-11-17** (local browser, Ana): live steps appear as they happen; the tutor asked for 2 snippets in parallel; "Buy it" on the $0.008 midterm set → bought, cited, charged $0.009; second question: two approval prompts at once, Skip one ("Not bought: You said no.") + approve the other → charged $0.001; balance 0.380 → 0.370 ✓; note page + recent sales ✓; prod build ✓. Next.js dev badge can cover the Ask button in a small window (dev only).
- Status: **Stages 1–5 working locally.** Next: Stage 6 (user writes demo notes; clear test data; seed; end-to-end on the live site) + README.
