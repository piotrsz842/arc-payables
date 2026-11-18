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

**Ratings.** After each answer the student can give a thumbs up or down. Ratings count toward the authors whose sections that answer used, appear on each author's dashboard, and break ties in search. Relevance always comes first.

## Cost at scale

Every question has two costs: the **notes** (fractions of a cent, paid to students over x402) and the **AI model calls** (paid by the platform). Measured on one typical question (search → buy one section → answer):

| Setup | Model calls | AI cost per question |
|---|---|---|
| Tutor Opus 5.5, checker Opus 5.5 (first version) | 4 | $0.041 |
| **Tutor Opus 5.5, checker Haiku 5.5 (current)** | 4 | **$0.026** |
| Tutor and checker on Haiku 5.5 (measured for comparison) | 4 | $0.001 |

How we keep it down:
- **Rules before AI.** Loop, duplicate, price cap, budget and balance checks are plain code and run first; reported or deleted sections can't even be found. When a rule decides, no model is called.
- **One checker call per question.** The checker (Claude Haiku 5.5) judges *all* candidate sections the tutor found, relevance and course-specific value together, in one call. It's reused for every purchase in that question. It sees only the question and the free previews, which also makes it harder to manipulate.
- **Prompt caching** on the tutor's tool loop: each step re-reads the same instructions and history from cache at a fraction of the price.
- **Capped outputs:** tutor 4,000 tokens per step, checker about 150 per candidate, upload previews about 200 per section.

**Who pays:** the platform's fee per purchase (see What's next) covers model cost. At $0.026 per question, a fee of a few cents per question covers it on Opus. On Haiku it would be a tenth of a cent. Test runs mock the AI (`npm run test-checker` uses a fake judge); real-model checks are opt-in (`-- --live`).

## What's next
- **Professor opt-in per course:** an instructor approves their course on the platform, can request removals directly, and can take a revenue share. This turns "students selling notes" into a course-sanctioned resource.
- **Platform fee:** a small cut per purchase to cover the cost of running the AI tutor and checker.
- Direct per-purchase author payouts (today authors are credited in our ledger and paid at cash-out), and author reputation built from ratings and upheld reports.
