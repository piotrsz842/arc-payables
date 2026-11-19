# NoteWorth

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

## What's next
- **Deeper QuickNode use:** route all Arc reads and writes through a QuickNode RPC endpoint, and add a second Stream that watches Circle Gateway batch settlements to the platform, so each sale is marked "settled on Arc" on the author's dashboard.
- **Bank payouts** through an off-ramp partner: authors cash out to a bank account in dollars. The cash-out screen already shows the option as "coming soon". Today authors can spend earnings on tutoring or send them to a crypto wallet.
- **Smart model routing:** answer most questions with Haiku and route hard ones (multi-step proofs, long derivations, low checker confidence) to a stronger model.
- **Professor opt-in per course:** an instructor approves their course on the platform, can request removals directly, and can take a revenue share. This turns "students selling notes" into a course-sanctioned resource.
- **Platform fee:** a small cut per purchase to cover the cost of running the AI tutor and checker.
- Direct per-purchase author payouts (today authors are credited in our ledger and paid at cash-out), and author reputation built from ratings and upheld reports.
