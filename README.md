# NoteWorth

**Your notes pay for your tutoring.** Students write great study guides and get nothing for them, while AI tutors don't know how *your* course teaches a topic. NoteWorth's AI tutor answers questions using study guides written by students in the course. It **pays the author a fraction of a cent every time it uses one**, and a separate checker must approve every purchase before any money moves.

Built for the UBC 2026 Hackathon on **Arc testnet** (Circle's stablecoin L1). Live: **https://arc-payables-chi.vercel.app**

- **For students:** sign up with an email (no wallet, no crypto), get 3 free questions, ask the tutor, practice with quizzes and flashcards.
- **For authors:** upload a study guide (typed or photos of handwritten pages) and watch earnings rise in dollars each time it's used. Earnings pay for your own questions, or you can cash them out.
- **For any AI agent:** buy a section over plain HTTP with x402: no account, no API key.

## How it works

```
 Student ──question──▶ Tutor agent (Claude) ──search previews (free)──▶ study-guide sections
                            │ proposes a purchase + reason
                            ▼
                    CHECKER (code rules → one Claude Haiku judgment per question)
                      allow │ block │ ask the student
                            ▼
              x402: GET /api/snippets/:id → 402 + price → signed Gateway payment → content
                            │                         (Circle Gateway Nanopayments on Arc)
                            ▼
                Ledger: author credited instantly ──▶ answer cites every section used
                            │
            Cash-out: Gateway withdrawal ─▶ Memo(payout ID) on Arc ─▶ optional CCTP to Base Sepolia
                            │
              QuickNode Stream sees the Memo event ─▶ "confirmed on chain"
```

1. **Signup** creates a Circle developer-controlled wallet on Arc behind the scenes. The student never sees an address.
2. **Upload:** a guide is split into sections at its headings. Claude writes a one-line preview for each, and each is priced by length ($0.001 per ~150 words, max $0.004). A near-duplicate check (pgvector) rejects copies of existing sections and of past tutor answers.
3. **Ask:** the tutor searches free previews (pgvector meaning search, filtered to the course first, plus keywords) and proposes sections to buy, each with a reason.
4. **Checker:** plain-code rules run first. Only if they pass does one isolated Claude Haiku call judge relevance and course-specific value. The verdict is logged *before* any money moves.
5. **Pay:** allowed sections are bought over **x402** with **Circle Gateway Nanopayments**. The author's ledger balance rises immediately, and Gateway settles the payments to the platform in batches on Arc.
6. **Answer:** the tutor answers using and citing the course-specific details (worked examples, exam tips). The page shows what was bought, what was skipped and why, and what it cost.
7. **Study mode:** quizzes and flashcards from the same engine. Sections you already own are reused for free.
8. **Cash-out:** earnings pay for your own questions. Or under *Advanced*, send USDC to your wallet: on Arc (a Gateway withdrawal tagged with a payout ID by Arc's Memo contract), or on Base Sepolia via CCTP.

## The agent's decision loop and safety limits

Design rule: **the AI may judge relevance, but code decides about money.**

| Check (in order) | Decides | Why |
|---|---|---|
| Loop detection | block after 6 proposals per question, or re-proposing a blocked section; the run stops after 2 loop blocks | an agent that keeps proposing instead of answering is stuck or manipulated |
| Duplicate | block | never pay twice in one question |
| Price cap | block above **$0.01** per section | hard ceiling (also enforced by a hook inside the payment SDK) |
| Question budget | block above the remaining **$0.01** per question (counting money already promised to parallel purchases) | the tutor can call tools in parallel; checks for one question run one at a time |
| Wallet balance | block if the agent's Gateway balance can't cover it | |
| Relevance (Claude Haiku) | block if off topic; ask the student if the preview is too vague to tell | sees **only** the question and the free previews: not the agent's reasons, the price or the conversation, so it can't be talked into a yes |
| Course-specific value | block "generic" sections (textbook facts the tutor already knows) | students are paid for what only the course's students know |
| Approval threshold | **ask the student** above **$0.005** | big purchases need a human: "Buy it" / "Skip" in the chat; no answer within 2 minutes = skip |
| Fail safe | if the judge can't run (outage, refusal) → ask the student | the checker never fails open |

Every decision is logged in `purchase_decisions` *before* payment. The receipt page and `npm run decision-log` show it. Tests: `npm run test-checker` (12 offline tests with a fake judge; `-- --live` adds one real batched judge call), `npm run stage2-demo` (8 scripted proposals showing every rule).

## Circle and Arc: what we use and why

| Protocol | Where | Why |
|---|---|---|
| **Arc** (testnet, chain 5042002) | everything on chain | USDC is the gas token, so every fee is in dollars; sub-second finality |
| **Circle Wallets** (developer-controlled, EOA) | every user, the platform, the checker | email signup with a hidden wallet: no seed phrases. Circle signs only when our server asks |
| **x402** | `GET /api/snippets/:id` | pay-per-request over plain HTTP: the server answers 402 with a price, and the client pays and retries. Any agent can buy, no account (see `npm run outside-agent`) |
| **Circle Gateway Nanopayments** | every section purchase | payments of a tenth of a cent signed offchain against a Gateway balance. Gateway settles them in **batches** on Arc, so there's no gas per purchase |
| **Gateway deposits and withdrawals** | top-ups and cash-outs | top-ups call `GatewayWallet.depositFor` straight into the tutor's spending balance. Cash-outs are a same-chain Gateway withdrawal (burn intent signed by the platform's Circle wallet → attestation → `gatewayMint`) paid from sales income |
| **Arc Memo extension** | every cash-out | the Gateway mint is wrapped in `Memo.memo(...)`, so each payout's ID is written on chain, with no names or emails |
| **CCTP** (via Circle App Kit, forwarder mode) | cash-out to Base Sepolia | burn on Arc, mint on Base Sepolia. Circle's forwarder does the destination side, so nobody needs gas there |
| **ERC-8004** (Arc's registries) | the tutor's identity and reputation | an on-chain agent identity, with reputation recorded by the checker after every question |

### Contract addresses (Arc testnet)

| Contract | Address |
|---|---|
| USDC (ERC-20, 6 decimals; also the gas token) | `0x3600000000000000000000000000000000000000` |
| Circle GatewayWallet | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` |
| Circle GatewayMinter | `0x0022222ABE238Cc2C7Bb1f21003F0a260052475B` |
| Arc Memo | `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` |
| CCTP V2 TokenMessenger (domain 26) | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` |
| CCTP V2 MessageTransmitter | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` |
| ERC-8004 IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ERC-8004 ReputationRegistry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| USDC on Base Sepolia (cash-out destination) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

Our tutor: **ERC-8004 agent #897944**. Platform wallet: `0x682f94386d613fb53fe4e21c566d13fcc4548c80`.

## Why x402

A study-guide section is worth a fraction of a cent. Subscriptions, API keys and invoices all cost more than that to set up. With x402 the price lives in the HTTP response itself (`402 Payment Required`), and payment is one signed header on the retry. That means:
- **Any agent can buy**, not just our tutor. `scripts/outside-agent.ts` has no account and uses none of our code: it reads free previews, gets a 402, pays $0.001 and gets the section, and the author is credited all the same.
- **Pay-per-use matches the value**: authors earn exactly when their work is used.
- **With Gateway Nanopayments behind it**, tiny payments are practical: signed offchain, settled in batches.

## Run it locally

Requires Node.js 22.18+, a Supabase project, a Circle developer account (Wallets), an Anthropic API key and a Voyage AI key.

```bash
npm install
cp .env.example .env    # fill in the values (each one is explained in the file)
```

1. **Database:** in Supabase's SQL Editor, run `supabase/schema.sql`, then `supabase/migrations/004_integrity.sql` through `007_handwritten.sql` in order (002 and 003 are already part of `schema.sql`).
2. **Circle:** `npm run register-secret` (registers your entity secret), `npm run pay -- create-wallets` (the platform wallet), then get test USDC at [faucet.circle.com](https://faucet.circle.com) (Arc Testnet).
3. **Tutor wallet:** `npm run make-agent-wallet`, `npm run pay -- fund-agent 2`, `npm run agent-pay -- deposit 1`.
4. **ERC-8004 (optional):** `npm run erc8004 -- setup-checker`, then `npm run erc8004 -- register https://<your-site>/agent.json`.
5. **Demo content:** `npm run seed` (demo student + checker demo sections), `npm run seed-notes` (study guides from `demo-notes/*.md`).
6. `npm run dev` → http://localhost:3000

Useful scripts: `npm run ledger` (everyone's balances), `npm run balances` (Gateway balances), `npm run decision-log`, `npm run outside-agent -- buy "<topic>"`, `npm run payout -- quote <email> <amount> arc|base_sepolia`, `npm run reports`, `npm run test-checker`.

## What is simulated

- **Testnet money:** all USDC is Arc/Base Sepolia testnet USDC from Circle's faucet. Nothing has real value.
- **Seeded content:** the demo study guides were written by the project author for a course they take; demo accounts are seeded.
- **Top-ups** come from a test wallet funded from the faucet. In production this would be a card on-ramp.
- **Bank payouts** are shown as "coming soon" and are not simulated.
- Everything else is real on testnet: wallets, x402 payments, Gateway deposits/withdrawals, Memo, CCTP, ERC-8004, QuickNode.

## Content quality and integrity

Paying students for their work only makes sense if what we sell is **their own work** and **worth paying for**. Four layers, from upload to answer:

1. **What we ask for.** Students upload *study guides in their own words*: explanations, worked examples, practice problems and exam tips for a course. Not lecture slides, handouts or copied text.
2. **Own-work confirmation at upload.** A required checkbox: *"This is my own work in my own words. It doesn't copy slides, handouts, or lecture text word for word, and isn't AI output."* It's checked again on the server and stored with the note (`notes.own_work_confirmed`).
3. **Reports take content off sale immediately.** Every section the tutor used has a **Report** link, in the live chat and on the receipt. Reasons: *copies course materials*, *instructor removal request*, *looks like AI output*, *wrong or misleading*, *other*. One report **flags** the section, and a flagged section stops being sold at once:
   - search skips it
   - the tutor can't buy it
   - the public x402 endpoint answers 404 *before* asking for payment, so outside agents can't buy it either

   A person reviews the report (`npm run reports`, a stand-in for a moderator screen). Upholding it keeps the section off sale; dismissing the last open report puts it back. The author sees "off sale: reported, under review" on their note page.
4. **The checker pays only for course-specific value.** Before every purchase, the separate checker call also asks: *does this section add course-specific information the tutor couldn't give on its own?* (a worked example, practice problems, exam tips, the course's notation or emphasis). Generic or recycled content, like a bare Big-O table any textbook has, is **blocked** with the reason shown: *"Generic: the tutor could answer this on its own."* The previews the checker judges are written to mention course-specific material when a section has it.

**Authors can delete their own study guides** (with a confirm step). Deleting is a *soft* delete that reuses the reports' remove-from-sale flag: the guide disappears from search, previews, the tutor and the x402 endpoint at once. Its rows stay, so past sales, earnings and cash-out history remain intact, and earnings already made can still be cashed out. **Content an AI agent already bought can't be taken back**, but it can't be sold again.

**Handwritten study guides.** Authors can photograph handwritten pages (phone camera or files, up to 6 pages). Claude's vision model (Haiku 5.5 by default) transcribes each page and rates how readable it is; dark, blurry or cut-off pages get a warning. The author sees each photo next to its transcription and fixes it before publishing. The published text goes through exactly the same checks as a typed upload: own-work confirmation, near-duplicate check, sections and pricing. The original photos are stored in a **private** bucket, and buyers only ever get the text. Such guides carry a **"Handwritten" badge**: a signal of human authorship, not proof (anyone can copy a printout by hand).

**Ratings.** After each answer the student can give a thumbs up or down. Ratings count toward the authors whose sections that answer used, appear on each author's dashboard, and break ties in search. Relevance always comes first.

## Agent identity and reputation (ERC-8004 on Arc)

The tutor is a registered **ERC-8004 agent on Arc testnet: agent #897944**.
- **Identity:** our platform wallet registered it in Arc's IdentityRegistry (`0x8004A818BFB912233c491871b3d84c89A494BD9e`). Its metadata URI is [`/agent.json`](https://arc-payables-chi.vercel.app/agent.json): name, the wallet it pays from, its x402 endpoints, and its spending rules.
- **Reputation:** after every question, the **checker's own Circle wallet** records feedback in the ReputationRegistry (`0x8004B663056A597Dffe9eCcC1965A193B7388713`). The score is the share of the tutor's purchase proposals that passed the checker (0–100, tag `purchase_discipline`, with a comment like "2 of 3 purchase proposals passed").
  - ERC-8004 doesn't let an agent's owner rate its own agent, so the checker signs with a separate wallet.
  - It's sent in the background, so the student never waits.
- *Honest limit:* both wallets belong to the platform today. In production, reputation should come from independent raters, such as students or outside validators.

## Independent confirmation of cash-outs (QuickNode Streams)

Every cash-out puts its payout ID on chain through Arc's Memo contract. A **QuickNode Stream** watches the chain and tells us when that memo appears, independent of our own code. The cash-out then shows **"✓ confirmed on chain"**.

| Setting | Value |
|---|---|
| Network | **Arc Testnet** |
| Dataset | **Logs** (event logs of every block) |
| Filter | Keep only logs where `address` = Memo contract `0x5294E9927c3306DcBaDb03fe70b92e01cCede505`, `topics[0]` = the `Memo(address,address,bytes32,bytes32,bytes,uint256)` event (`0xeb15ee72…a5e4`), and `topics[1]` (the sender) = our platform wallet. The filter code is in [`docs/quicknode-filter.js`](docs/quicknode-filter.js). |
| Destination | **Webhook** `POST https://arc-payables-chi.vercel.app/api/streams/quicknode`, payload compression off |
| Security | Each request is signed: `X-QN-Signature` = HMAC-SHA256(nonce + timestamp + body) with the stream's security token. We reject bad signatures (401) and messages older than 10 minutes. |
| What we do | Decode the Memo event, read the payout ID, find that cash-out in our ledger, and stamp it "confirmed on chain" (by QuickNode, with tx hash and block). |

**Why:** our app already reads its own transactions back from Arc. A stream is a *second, independent* witness: if our server crashes mid-cash-out, or someone claims a payout never happened, the confirmation comes from the chain via a third party. The same stream could later drive author notifications or accounting exports. Test without QuickNode: `npm run test-stream-webhook -- <cash-out tx hash>` builds a real Logs payload and signs it.

*Cost note:* Arc makes a block about every 0.5 s and Streams bills per block (20 credits on the Logs dataset, filters don't reduce it). That's about 3.5M credits a day, so on the free plan we run the stream during demos.

## Cost at scale

Every question has two costs: the **notes** (fractions of a cent, paid to students over x402) and the **AI model calls** (paid by the platform). Measured on one typical question (search → buy one section → answer):

| Setup | Model calls | AI cost per question |
|---|---|---|
| Tutor Opus 5.5, checker Opus 5.5 (first version) | 4 | $0.041 |
| Tutor Opus 5.5, checker Haiku 5.5 (setting `TUTOR_MODEL=claude-opus-5-5`) | 4 | $0.028 |
| **Tutor and checker on Haiku 5.5 (default)** | 4 | **$0.001** |

How we keep it down:
- **Rules before AI.** Loop, duplicate, price cap, budget and balance checks are plain code and run first; reported or deleted sections can't even be found. When a rule decides, no model is called.
- **One checker call per question.** The checker (Claude Haiku 5.5) judges *all* candidate sections the tutor found, relevance and course-specific value together, in one call. It's reused for every purchase in that question. It sees only the question and the free previews, which also makes it harder to manipulate.
- **Prompt caching** on the tutor's tool loop: each step re-reads the same instructions and history from cache at a fraction of the price.
- **Capped outputs:** tutor 4,000 tokens per step, checker about 150 per candidate, upload previews about 200 per section.

**Why the tutor defaults to Haiku 5.5:** the hard part, knowing how *this* course teaches a topic, comes from the students' study guides the tutor buys, not from the model's own knowledge. Given those sections, Haiku writes a correct, cited answer built on the course's worked examples and exam tips for about 1/26 of Opus's cost (side-by-side in [`docs/tutor-model-comparison.md`](docs/tutor-model-comparison.md)). The model is a setting (`TUTOR_MODEL`). Routing harder questions automatically to a stronger model is listed under What's next.

**Who pays:** the platform's fee per purchase (see What's next) covers model cost. On Haiku that's about a tenth of a cent per question; on Opus, a few cents. Test runs mock the AI (`npm run test-checker` uses a fake judge); real-model checks are opt-in (`-- --live`).

## Scaling

- **Search:** sections carry pgvector embeddings (Voyage `voyage-4-lite`, 1024 dims) with an HNSW index. Search filters to the course *inside Postgres* first, then ranks by meaning plus keyword hits, so it stays fast as the library grows. The fallback is keyword search.
- **Storage:** text in Postgres (Supabase); handwritten originals in a private storage bucket. Sections are small (max 20 per guide, ~250 words each).
- **Payments:** Gateway Nanopayments are signed offchain and **settled in batches** on Arc, so a million $0.001 purchases don't mean a million transactions. Authors are credited in our ledger instantly and paid out on demand.
- **Checker cost:** rules run first and skip the AI. Then one Claude Haiku call per question covers *all* candidate sections, at about $0.0003 a question. Measured cost per question is in "Cost at scale".
- **Moderation:** one report takes a section off sale instantly; review is a queue (`npm run reports`). The near-duplicate check and own-work confirmation run at upload. At scale: reviewer tooling, author reputation, and professor opt-in per course.

## Known limitations (honest list)

- **Raw agent key:** the tutor's wallet is a raw private key in a server environment variable, because Circle's Gateway buyer client (`GatewayClient`) signs with a raw key. Its exposure is capped: it only holds a small spending budget, and a hook refuses any payment above $0.01.
- **Ledger-based author payouts:** each purchase pays the *platform's* Gateway balance; authors are credited in our ledger and receive USDC when they cash out (from the platform's Gateway income). Direct per-purchase payouts are under What's next.
- **Base Sepolia funds aren't usable in the app:** a CCTP cash-out lands at the author's own address on Base Sepolia. We don't create or show a Base Sepolia wallet, so the app can't spend those funds.
- **No memo on the CCTP leg:** the payout ID is written on chain on the Arc leg (Memo); the CCTP burn itself carries no memo. Our ledger links the two transactions.
- **Approval-timeout budget behavior:** when a purchase waits for the student's OK and times out (2 minutes), its price still counts against that question's budget. This is deliberately cautious.
- **Cash-out limits:** authors can cash out what their guides *earned*; money added by top-up is for questions. Very fresh earnings may still be settling into Gateway (usually minutes).
- **Same owner, two wallets:** ERC-8004 reputation is recorded by the platform's checker wallet; truly independent raters are future work.
- **Rate limits:** the signup limit is site-wide plus best-effort per visitor; there is no CAPTCHA.
- **Testnet only**, and `npm audit` flags an `elliptic` advisory inside Circle's SDK dependencies (we don't sign with it).

## Demo walkthrough (for judges)

Open **https://arc-payables-chi.vercel.app** on a phone or laptop.

1. **Sign up** with any email: you get 3 free questions. No wallet setup, no crypto words.
2. **Ask** (home screen or the Ask tab), for example *"CPSC 221: why does quicksort take O(n²) on sorted input?"*. Watch the summary chip ("Used 1 study guide · $0.001 · Skipped 1") and open **Details** to see each checker decision. The answer cites the study guide it used.
3. **See a block:** on-topic but generic sections are skipped with *"Generic: the tutor could answer this on its own"*; off-topic ones are skipped as not relevant.
4. **Approve a purchase:** ask about *"the midterm"*. The $0.008 solution set triggers **Buy it / Skip** (above the $0.005 approval threshold).
5. **Study:** Study tab → quiz or flashcards on a topic. Sections you already bought are reused for free.
6. **Be an author:** Upload → type a guide, or photograph handwritten pages (photo beside the transcription, a "Handwritten" badge once published). Earnings show in dollars on Home and Earnings.
7. **Cash out:** Earnings → *Use for tutoring*, or *Advanced → Send to a crypto wallet → Arc*. The confirm screen shows fees and what arrives; the cash-out gets a **Confirmed** badge once QuickNode sees its Memo event on Arc.
8. **Any agent can buy:** `npm run outside-agent -- buy "quicksort pivot" "CPSC 221"` buys a section over x402 with no account.
9. **On-chain proof:** every receipt and cash-out has a *Details* toggle with Gateway transfer IDs and Arc explorer links; the tutor's identity is ERC-8004 agent #897944 ([/agent.json](https://arc-payables-chi.vercel.app/agent.json)).

## What's next
- **Deeper QuickNode use:** route all Arc reads and writes through a QuickNode RPC endpoint, and add a second Stream that watches Circle Gateway batch settlements to the platform, so each sale is marked "settled on Arc" on the author's dashboard.
- **Bank payouts** through an off-ramp partner: authors cash out to a bank account in dollars. The cash-out screen already shows the option as "coming soon". Today authors can spend earnings on tutoring or send them to a crypto wallet.
- **Smart model routing:** answer most questions with Haiku and route hard ones (multi-step proofs, long derivations, low checker confidence) to a stronger model.
- **Professor opt-in per course:** an instructor approves their course on the platform, can request removals directly, and can take a revenue share. This turns "students selling notes" into a course-sanctioned resource.
- **Platform fee:** a small cut per purchase to cover the cost of running the AI tutor and checker.
- Direct per-purchase author payouts (today authors are credited in our ledger and paid at cash-out), and author reputation built from ratings and upheld reports.
