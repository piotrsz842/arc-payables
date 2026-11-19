/**
 * Try the note → snippets pipeline without saving anything:
 * split (code) → previews (Claude) → prices (code).
 *
 * Run: npm run test-notes [-- path/to/notes.md]
 * Without a file it uses a tiny built-in TEST sample (not real demo content).
 */
import { readFileSync } from "node:fs";
import { describeChunks, splitNote } from "../lib/notes.js";
import { priceSection, wordCount } from "../lib/pricing.js";

const SAMPLE = `# Quicksort
Quicksort picks a pivot, partitions the array into smaller and larger elements, and recurses on both sides.

## Worst case
If the pivot is always the smallest or largest element, for example the first element of an already sorted array, each partition removes only one element, so the work is n + (n-1) + ... + 1 = O(n^2).

## Avoiding it
Choose the pivot randomly or use median-of-three. Then the O(n^2) case becomes extremely unlikely and the expected time is O(n log n).

# Merge sort
Merge sort splits the array in half, sorts each half, and merges them. It is O(n log n) in every case but needs O(n) extra space.`;

const file = process.argv[2];
const body = file ? readFileSync(file, "utf8") : SAMPLE;
const chunks = splitNote(body);
console.log(`${chunks.length} snippets\n`);
const previews = await describeChunks("CPSC 221", "Sorting", chunks);
chunks.forEach((c, i) => {
  console.log(`#${i + 1}  $${priceSection(wordCount(c)).usd}  ${previews[i].title}`);
  console.log(`    ${previews[i].summary}`);
  console.log(`    (${c.split(/\s+/).length} words: "${c.slice(0, 60).replace(/\n/g, " ")}…")\n`);
});
