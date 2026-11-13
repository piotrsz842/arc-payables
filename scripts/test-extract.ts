/**
 * Run the AI extraction on the sample invoices and print what it found.
 * The fraud sample should come back with the attacker's address in
 * payout_address and the hidden instruction quoted in suspicious_text.
 *
 * Run: npm run test-extract            (all files in samples/)
 *      npm run test-extract -- my.pdf  (one file)
 *
 * Each call costs roughly a cent (one short PDF on Claude Opus 5.5).
 */
import { readdirSync, readFileSync } from "node:fs";
import { extractInvoice } from "../lib/extract.js";

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync("samples").filter((f) => f.endsWith(".pdf")).map((f) => `samples/${f}`);

for (const file of files) {
  console.log(`\n=== ${file}`);
  try {
    const inv = await extractInvoice(readFileSync(file));
    console.log(`  vendor:          ${inv.vendor_name}`);
    console.log(`  invoice #:       ${inv.invoice_number}`);
    console.log(`  amount:          ${inv.amount} ${inv.currency}`);
    console.log(`  due:             ${inv.due_date}`);
    console.log(`  category:        ${inv.category}`);
    console.log(`  payout address:  ${inv.payout_address}`);
    console.log(`  suspicious text: ${inv.suspicious_text.length ? "" : "(none)"}`);
    inv.suspicious_text.forEach((t) => console.log(`    - "${t}"`));
  } catch (err: any) {
    console.log(`  FAILED: ${err?.message ?? err}`);
  }
}
