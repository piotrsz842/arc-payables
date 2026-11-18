# Tutor model: Opus 5.5 vs Haiku 5.5 (same question, same notes)

Measured 2026-11-18. Question: *"CPSC 221: why does quicksort take O(n^2) on sorted input, and how do I avoid it?"*
Both bought the same section ("Quicksort pivot choice and the worst case", a course-specific worked example), and both cited it.

| | Opus 5.5 (current) | Haiku 5.5 |
|---|---|---|
| Cost per question (tutor + checker) | $0.0257 | $0.0010 |
| Model calls | 4 | 4 |
| Used the course's worked example [1..5] | yes | yes |
| Used the note's **quiz tip** ("name the fix; say it's still possible") | **yes, explicitly** | partly (says "still theoretically possible", doesn't call it a quiz tip) |
| Extra general knowledge | brief note on why balanced splits give n log n | shuffle-first fix; merge/heapsort guarantee O(n log n) |
| Labelled what came from the note | yes | yes |

## Opus 5.5 answer

**Why sorted input gives O(n²)**

In CPSC 221, quicksort uses the **first element as the pivot**. On sorted input, that pivot is always the smallest element left, so every partition is as uneven as it can be:

- Sorting [1,2,3,4,5] with pivot 1 leaves nothing on the left and [2,3,4,5] on the right.
- Pivot 2 leaves [3,4,5], and so on.

Each step removes only one element, but it still compares the pivot against everything left. The total work is n + (n−1) + … + 1 = n(n+1)/2, which is **O(n²)** [Quicksort pivot choice and the worst case].

Compare this with a good pivot that splits the array roughly in half. Then there are only about log n levels of recursion, each doing O(n) work, so the total is O(n log n). Sorted input is the worst case only because of how the pivot is chosen.

**How to avoid it**

Choose a better pivot:
- **Median-of-three:** use the median of the first, middle and last elements. On sorted input this picks the true middle value, so the splits are perfectly balanced.
- **Random pivot:** pick a random index, so no particular input order is consistently bad.

**Tip for quizzes:** the note says quizzes ask you to name the fix. Name either method, and add that it makes the worst case very unlikely but **still possible**. The worst case is still O(n²); it just becomes extremely rare in practice [Quicksort pivot choice and the worst case].

## Haiku 5.5 answer

**Why sorted input is O(n²):** Quicksort partitions around a pivot, then recurses on the two sides. If the pivot is the first element and the input is already sorted, the pivot is always the smallest remaining element. That means one side is empty and the other side holds everything else, so each partition removes only one element.

For [1,2,3,4,5]:
- Pivot 1: right side is [2,3,4,5]
- Pivot 2: right side is [3,4,5]
- and so on

The partitioning work is 5 + 4 + 3 + 2 + 1 = n(n+1)/2, which is O(n²). The recursion is n levels deep instead of log n, so you never get the balanced splits that give O(n log n). [Quicksort pivot choice and the worst case]

**How to avoid it:** The problem is the pivot choice, not the algorithm itself. Common fixes:
- **Median-of-three:** Take the median of the first, middle, and last elements as the pivot. On sorted input this gives a near-perfect split.
- **Random pivot:** Pick a random element as the pivot. No fixed input can reliably trigger the worst case, though it's still theoretically possible.
- **Shuffle first:** Randomly permute the array before sorting.

Each of these makes the worst case very unlikely in practice, but quicksort's worst case is still O(n²). Merge sort and heapsort guarantee O(n log n) if you need a hard bound. [Quicksort pivot choice and the worst case]
