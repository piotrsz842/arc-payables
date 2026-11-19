/**
 * Compare Haiku 5.5 and Opus 5.5 transcribing one handwritten page.
 *
 *   npm run test-transcribe -- [photo.jpg]
 * Without a photo, it renders a stand-in page (handwriting-style font on lined
 * paper) with Edge, so the test runs anywhere. Real photos are the real test.
 * Costs two vision calls (about $0.001 Haiku + $0.02 Opus).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";
import { transcribePage } from "../lib/handwritten.js";
import { UsageMeter } from "../lib/usage.js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
let photo: Buffer;
if (process.argv[2]) photo = readFileSync(process.argv[2]);
else {
  const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 1000 } });
  await page.setContent(`<link href="https://fonts.googleapis.com/css2?family=Caveat&display=swap" rel="stylesheet">
  <body style="margin:0;background:#f4f1e8"><div style="transform:rotate(-1.2deg);margin:30px;padding:30px 40px;font:30px/44px Caveat,cursive;color:#1b2a6b;
  background:repeating-linear-gradient(#fdfcf7 0 43px,#9db7d8 43px 44px)">
  <div style="font-size:40px"><u>CPSC 221 - Hash tables</u></div>
  load factor α = n / m (items / buckets)<br>keep α &lt; 0.75 → resize: double m + rehash everything<br>
  amortized insert stays O(1)!!<br><br>
  <u>Collisions</u> - separate chaining = linked list per bucket<br>
  linear probing → primary clustering (bad)<br>
  Exam tip (Prof said): know why double hashing spreads keys better<br>
  common mistake: forgetting to rehash ALL keys after resize</div></body>`);
  await page.waitForTimeout(800);
  photo = await page.screenshot({ type: "jpeg", quality: 80 });
  await browser.close();
  writeFileSync("docs/screenshots/handwritten-test-page.jpg", photo);
  console.log("Rendered a stand-in page: docs/screenshots/handwritten-test-page.jpg\n");
}

const { data: author } = await db.from("profiles").select("id").eq("email", "test-author-2@example.com").single();
for (const model of ["claude-haiku-5-5", "claude-opus-5-5"]) {
  const meter = new UsageMeter();
  const page = await transcribePage(db, author!.id, photo, meter, model);
  console.log(`===== ${model}: legibility ${page.legibility}, issues [${page.issues.join(", ")}], dark ${page.darkPhoto}, $${meter.totalUsd.toFixed(4)}`);
  console.log(page.text, "\n");
}
