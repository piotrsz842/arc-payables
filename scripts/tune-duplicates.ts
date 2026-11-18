/**
 * Tune the near-duplicate thresholds with real examples (Voyage embeddings
 * only, no Claude calls). Prints how similar each test text is to its nearest
 * existing section and nearest past tutor answer.
 *
 * Run: npm run tune-duplicates
 */
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "../lib/circle.js";
import { embed, sectionText, toVector } from "../lib/embeddings.js";
import { DUPLICATE_OF_ANSWER, DUPLICATE_OF_SECTION } from "../lib/notes.js";

const db = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false },
});

const { data: heap } = await db.from("snippets").select("course, title, summary, content").ilike("title", "%heap insert%").limit(1).single();
const { data: run } = await db.from("agent_runs").select("answer").ilike("answer", "%median-of-three%").not("answer_embedding", "is", null).limit(1).single();
if (!heap || !run) throw new Error("Need the Heaps test note and a past quicksort answer in the database");

const reworded = heap.content
  .replace("To insert, put", "When inserting, place")
  .replace("bubble it up", "sift it upward")
  .replace("To remove the minimum", "For remove-min")
  .replace("Both operations", "Each of these operations");

const cases: { name: string; expect: "copy" | "own work"; text: string }[] = [
  { name: "exact copy of a listed section", expect: "copy", text: sectionText(heap) },
  { name: "lightly reworded copy", expect: "copy", text: sectionText({ ...heap, content: reworded }) },
  {
    name: "same topic, own explanation",
    expect: "own work",
    text: sectionText({
      course: "CPSC 221",
      title: "My heap cheat sheet",
      summary: "How I remember heap insert and delete-min, with the trick from tutorial.",
      content:
        "I think of insert as 'add at the bottom, then climb': the new key keeps swapping with its parent until the parent is smaller. " +
        "Delete-min is the reverse: grab the root, move the last leaf to the top, and let it sink by always swapping with the smaller child. " +
        "Tutorial tip: draw the array and the tree side by side, index i has children 2i+1 and 2i+2. Both are log n because the tree is complete.",
    }),
  },
  {
    name: "different topic, same course",
    expect: "own work",
    text: sectionText({
      course: "CPSC 221",
      title: "AVL rotations",
      summary: "When to use single vs double rotations in AVL trees.",
      content: "An AVL tree rebalances when a node's balance factor hits 2. Left-left uses a single right rotation; left-right needs a double rotation.",
    }),
  },
  {
    name: "own explanation of an answered topic",
    expect: "own work",
    text: sectionText({
      course: "CPSC 221",
      title: "Quicksort: my worst-case walkthrough",
      summary: "My own trace of quicksort's worst case with a last-element pivot, plus how I remember the fix for the exam.",
      content:
        "I traced quicksort on [5,4,3,2,1] with the LAST element as pivot, the way our TA did on the board. Pivot 1 ends up at the front and " +
        "everything else stays on one side, then pivot 2, and so on. I count comparisons: 4 + 3 + 2 + 1 = 10, which matches n(n-1)/2, so it's quadratic. " +
        "How I remember the fix: 'never trust the ends'. Use the middle of three or a random index. On the exam I also write that the worst case still exists.",
    }),
  },
  {
    name: "pasted tutor answer",
    expect: "copy",
    text: sectionText({ course: "CPSC 221", title: "Quicksort worst case", summary: "Why quicksort is O(n^2) on sorted input and how to avoid it.", content: run.answer as string }),
  },
  {
    name: "tutor answer, first half only",
    expect: "copy",
    text: sectionText({
      course: "CPSC 221",
      title: "Quicksort notes",
      summary: "Quicksort worst case.",
      content: (run.answer as string).slice(0, Math.floor((run.answer as string).length / 2)),
    }),
  },
];

const vectors = await embed(cases.map((c) => c.text), "document");
console.log(`Thresholds now: section ≥ ${DUPLICATE_OF_SECTION}, answer ≥ ${DUPLICATE_OF_ANSWER}\n`);
for (const [i, c] of cases.entries()) {
  const { data, error } = await db.rpc("nearest_existing", { query_embedding: toVector(vectors[i]) });
  if (error) throw new Error(error.message);
  const hits = data as { kind: string; similarity: number }[];
  const sec = hits.find((h) => h.kind === "snippet")?.similarity ?? 0;
  const ans = hits.find((h) => h.kind === "answer")?.similarity ?? 0;
  const flagged = sec >= DUPLICATE_OF_SECTION || ans >= DUPLICATE_OF_ANSWER;
  const ok = flagged === (c.expect === "copy");
  console.log(`${ok ? "OK  " : "MISS"} ${c.name.padEnd(34)} section ${sec.toFixed(3)}  answer ${ans.toFixed(3)}  → ${flagged ? "rejected" : "allowed"} (expected ${c.expect})`);
}
