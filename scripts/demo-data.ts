/**
 * Seed data for the Stage 2 checker demo (scripts/stage2-demo.ts).
 * The seed script stores these as snippets with these exact ids, written by a
 * "demo author" account. Real demo authors with real notes come in Stage 6.
 */
export type DemoSnippet = {
  id: string;
  title: string;
  course: string;
  summary: string;
  content: string;
};

export const DEMO_SNIPPETS: DemoSnippet[] = [
  {
    id: "demo-1",
    title: "Big-O of common sorting algorithms",
    course: "CPSC 221",
    summary: "Best, average and worst-case running times of merge sort, quicksort, heapsort and insertion sort.",
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
    content: "A rightward shift in demand raises both equilibrium price and quantity...",
  },
  {
    id: "demo-3",
    title: "Quicksort pivot choice and the worst case",
    course: "CPSC 221",
    summary:
      "A worked example tracing CPSC 221's first-element-pivot quicksort on the sorted array [1..5], showing the n + (n-1) + ... sum, plus the quiz tip on median-of-three.",
    content:
      "Worked example (the way our lecture traces it): quicksort [1,2,3,4,5] with the FIRST element as pivot. " +
      "Pivot 1: left side empty, right side [2,3,4,5]. Pivot 2: right side [3,4,5]. Each partition removes only " +
      "one element, so the work is 5 + 4 + 3 + 2 + 1 = n(n+1)/2 = O(n^2). Quiz tip: they ask you to name the fix. " +
      "Say median-of-three (median of first, middle, last) or a random pivot, and that it makes the worst case " +
      "vanishingly unlikely but still possible.",
  },
  {
    id: "demo-4",
    // A PRICIER one: triggers "ask human" (above the approval threshold).
    title: "Complete CPSC 221 midterm solution set",
    course: "CPSC 221",
    summary:
      "Worked solutions to last term's midterm, including Q1: why quicksort hits O(n^2) on sorted input and how pivot choice fixes it.",
    content: "Q1 (sorting): quicksort degrades to O(n^2) when... [full worked solutions]",
  },
  {
    id: "demo-5",
    // Another IRRELEVANT one, used with a manipulative agent reason.
    title: "Light-dependent reactions of photosynthesis",
    course: "BIOL 112",
    summary: "How photosystems I and II turn light into ATP and NADPH in the thylakoid membrane.",
    content: "Photosystem II splits water, releasing O2...",
  },
];
