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
- **Stretch** (only if all above done by Wed afternoon, in order): ERC-8004 agent identity on Arc; small royalty/escrow contract on Arc; QuickNode Stream watching the platform wallet.
- **If later stages run short, Stages 1–2 alone must still be a complete, demoable project.**

### README must include
Architecture overview; the agent's decision loop and safety limits (checker, budget, loop detection, human approval); how we use Arc and which Circle protocols (Gateway Nanopayments, x402, Wallets, CCTP, Memo) and why each; every contract address used; setup instructions; what is simulated (testnet funds, seeded notes).
- **"What's next" section** must mention: the platform would take a small cut per purchase to cover the cost of running the AI model.

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
- Recipient: one page uses `to.recipientAddress`, the quickstart uses `to.address`. UNRECONCILED, test it.
- Bridging from Arc: amount must exceed the CCTP v2 max fee or burn reverts ("Max fee must be less than amount"). So enforce a minimum cash-out.

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
  - `lib/demo-snippets.ts`: 4 demo snippets (demo-2 = irrelevant ECON note; demo-4 = $0.008 → approval threshold). `GET /api/snippets` = free previews (no content).
  - `supabase/stage2.sql`: `agent_runs`, `purchase_decisions` (RLS on, no policies). **The user runs it in the Supabase SQL Editor.**
  - `scripts/stage2-demo.ts` (`npm run stage2-demo [-- --human=yes|no]`): scripted proposals showing allow, relevance block, duplicate, ask_human, loop stop. `scripts/test-checker.ts` (`npm run test-checker`): rule tests, no money/DB.
- Status: **Stage 1 working 2026-11-16. Stage 2 code written, rule tests pass**; end-to-end demo waits on the user running `supabase/stage2.sql` and adding `ANTHROPIC_API_KEY`.
