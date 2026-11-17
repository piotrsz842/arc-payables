/**
 * Hard-coded demo snippets for Stages 1–2. Stage 3 replaces this file with
 * real notes uploaded by authors (stored in the database).
 *
 * Each snippet has a FREE preview (title, course, one-line summary) that
 * anyone can read, and PAID content that costs a fraction of a cent.
 */
export type Snippet = {
  id: string;
  title: string;
  course: string;
  summary: string; // one line, part of the free preview
  priceUsd: string;
  content: string; // only returned after payment
};

export type SnippetPreview = Omit<Snippet, "content">;

export const DEMO_SNIPPETS: Snippet[] = [
  {
    id: "demo-1",
    title: "Big-O of common sorting algorithms",
    course: "CPSC 221",
    summary: "Best, average and worst-case running times of merge sort, quicksort, heapsort and insertion sort.",
    priceUsd: "0.001",
    content:
      "Merge sort: O(n log n) always. Quicksort: O(n log n) average, O(n^2) worst. " +
      "Heapsort: O(n log n) always, not stable. Insertion sort: O(n^2), but O(n) on nearly-sorted input.",
  },
  {
    id: "demo-2",
    // The deliberately IRRELEVANT one: an economics note, for a CS question.
    title: "Supply and demand shifts",
    course: "ECON 101",
    summary: "How shifts in supply and demand curves move equilibrium price and quantity.",
    priceUsd: "0.001",
    content: "A rightward shift in demand raises both equilibrium price and quantity...",
  },
  {
    id: "demo-3",
    title: "Quicksort pivot choice and the worst case",
    course: "CPSC 221",
    summary: "Why a bad pivot makes quicksort quadratic, and how median-of-three or random pivots avoid it.",
    priceUsd: "0.001",
    content:
      "If the pivot is always the smallest or largest element (e.g. first element on sorted input), " +
      "each partition removes only one element: n + (n-1) + ... = O(n^2). Random or median-of-three " +
      "pivots make that case vanishingly unlikely.",
  },
  {
    id: "demo-4",
    // A PRICIER one: triggers "ask human" (above the approval threshold).
    title: "Complete CPSC 221 midterm solution set",
    course: "CPSC 221",
    summary: "Worked solutions to every question on last term's midterm, including the sorting section.",
    priceUsd: "0.008",
    content: "Q1 (sorting): quicksort degrades to O(n^2) when... [full worked solutions]",
  },
];

export function findSnippet(id: string): Snippet | undefined {
  return DEMO_SNIPPETS.find((s) => s.id === id);
}

/** The free part only: never includes `content`. */
export function toPreview({ content: _content, ...preview }: Snippet): SnippetPreview {
  return preview;
}
