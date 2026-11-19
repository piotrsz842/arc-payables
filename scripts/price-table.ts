/**
 * Example prices from the platform's pricing formula (lib/pricing.ts).
 * Run: npm run price-table
 */
import { explainPrice, priceSection } from "../lib/pricing.js";

const cases: [label: string, words: number, up: number, down: number][] = [
  ["New author, 300 words", 300, 0, 0],
  ["New author, 150 words", 150, 0, 0],
  ["New author, 60 words", 60, 0, 0],
  ["3 helpful, 0 not (few votes)", 300, 3, 0],
  ["10 helpful, 0 not", 300, 10, 0],
  ["48 of 50 helpful", 300, 48, 2],
  ["100 of 100 helpful", 300, 100, 0],
  ["2 of 10 helpful (few votes)", 300, 2, 8],
  ["5 of 30 helpful (poorly rated)", 300, 5, 25],
  ["0 of 50 helpful", 300, 0, 50],
];
console.log("| Author's ratings | Words | Price | Breakdown |\n|---|---|---|---|");
for (const [label, words, up, down] of cases) {
  const p = priceSection(words, { up, down });
  console.log(`| ${label} | ${words} | $${p.usd} | ${explainPrice(p)} |`);
}
