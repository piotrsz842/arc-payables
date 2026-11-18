# Tutor model: Haiku 5.5 vs Opus 5.5 (same question, same study guide, new prompt)

Measured 2026-11-18 after the prompt change ("build the answer around the course-specific details in the bought sections, say where each comes from, cite right after each point, keep general knowledge separate").
Question: *"CPSC 221: why does quicksort take O(n^2) on sorted input, and how do I avoid it?"* Both bought the same section ("Quicksort pivot choice and the worst case": a course worked example on [1..5] plus a quiz tip). The checker is Haiku 5.5 in both runs.

| | **Haiku 5.5 (default)** | Opus 5.5 |
|---|---|---|
| Cost per question (tutor + checker, 4 calls) | **$0.0011** | $0.0285 (≈26×) |
| Uses the course's worked example [1..5] | yes, attributed ("In CPSC 221's worked example") | yes, attributed ("the course's worked example") |
| Uses the quiz tip "name the fix" | yes, attributed ("The course's quiz tip…") | yes, attributed |
| Uses the quiz tip "…but still possible" | mentions it, not attributed to the tip | **yes, attributed as a quiz tip** |
| Cites right after each point | yes (3 citations) | yes (4 citations) |
| General knowledge labelled | yes ("General note: recurrence T(n)=2T(n/2)+O(n)") | yes ("In general, …") |
| Accuracy | correct | correct |

**Takeaway:** with the course material supplied by students, Haiku gives a correct, course-grounded, cited answer for about 1/26 of the cost. Opus is slightly more thorough in using every detail. Default: Haiku (setting `TUTOR_MODEL`, e.g. `claude-opus-5-5`). The user picks the model for the demo.

## Haiku 5.5 answer

**Why sorted input causes O(n²):** Quicksort's cost depends on how evenly each partition splits the array. With the first element as pivot, sorted input gives the worst split every time. In CPSC 221's worked example, quicksorting [1,2,3,4,5] with the first element as pivot works like this: pivot 1 leaves an empty left side and [2,3,4,5] on the right; pivot 2 leaves [3,4,5]; and so on. Each partition removes only one element, so the total work is 5 + 4 + 3 + 2 + 1 = n(n+1)/2 = O(n²) [Quicksort pivot choice and the worst case].

The same thing happens with any input where the pivot is always the smallest or largest element, such as reverse-sorted input under the same rule.

**How to avoid it:**
- **Median-of-three:** Take the median of the first, middle, and last elements as the pivot. On sorted input this picks the true middle, so the split is balanced. The course's quiz tip is that you may be asked to name this fix [Quicksort pivot choice and the worst case].
- **Random pivot:** Pick a random element as the pivot. No fixed input order can force bad splits every time, so the O(n²) case becomes very unlikely, though still possible in principle [Quicksort pivot choice and the worst case].

**General note:** With a balanced split, the recurrence is T(n) = 2T(n/2) + O(n), which gives O(n log n) on average. Median-of-three and random pivots don't change the worst-case bound on paper for every pivot rule, but they make the bad case practically unlikely.

## Opus 5.5 answer

**Why sorted input is the worst case**

The trouble is the pivot. CPSC 221's quicksort uses the **first element** as the pivot. On an already-sorted array, the first element is always the smallest, so every partition is as uneven as it can be.

Here's the course's worked example, quicksorting `[1,2,3,4,5]` [Quicksort pivot choice and the worst case]:
- Pivot 1: the left side is empty and the right side is `[2,3,4,5]`
- Pivot 2: the right side is `[3,4,5]`
- …and so on. Each partition removes only one element.

The total work is 5 + 4 + 3 + 2 + 1 = n(n+1)/2, which is **O(n²)** [Quicksort pivot choice and the worst case].

In general, quicksort is fast when the pivot splits the array roughly in half. Then you get about log n levels of recursion, each doing O(n) work, for O(n log n) overall. A bad pivot gives you n levels instead. Reverse-sorted input causes the same problem for the same reason.

**How to avoid it**

Choose a better pivot. The study notes say quizzes ask you to name the fix, so give one of these answers [Quicksort pivot choice and the worst case]:
- **Median-of-three:** use the median of the first, middle and last elements. On sorted input that's the middle value, which splits the array perfectly.
- **Random pivot:** pick the pivot at random, so no fixed input order can reliably trigger the worst case.

**Quiz tip** from the same notes: also say that these fixes make the worst case **vanishingly unlikely but still possible** [Quicksort pivot choice and the worst case]. The worst case is still O(n²); only the expected running time improves to O(n log n).
