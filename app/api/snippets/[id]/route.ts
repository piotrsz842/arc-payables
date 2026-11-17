/**
 * GET /api/snippets/:id → a note snippet, paid per request over x402.
 *
 * Stage 1: two hard-coded demo snippets so we can prove the payment rail.
 * Stage 3 replaces DEMO_SNIPPETS with the database (real notes from authors).
 */
import { NextResponse, type NextRequest } from "next/server";
import { requirePayment } from "@/lib/x402";

const DEMO_SNIPPETS: Record<string, { title: string; course: string; priceUsd: string; content: string }> = {
  "demo-1": {
    title: "Big-O of common sorting algorithms",
    course: "CPSC 221",
    priceUsd: "0.001",
    content: "Merge sort is O(n log n) in every case; quicksort is O(n log n) on average but O(n^2) worst case...",
  },
  "demo-2": {
    title: "Supply and demand shifts",
    course: "ECON 101",
    priceUsd: "0.001",
    content: "A rightward shift in demand raises both equilibrium price and quantity...",
  },
};

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const snippet = DEMO_SNIPPETS[id];
  // Check the snippet exists BEFORE asking for money, so nobody pays for a 404.
  if (!snippet) return NextResponse.json({ error: "No such snippet" }, { status: 404 });

  return requirePayment(
    req,
    { priceUsd: snippet.priceUsd, description: `Note snippet: ${snippet.title}` },
    (receipt) => NextResponse.json({ id, ...snippet, receipt }),
  );
}
