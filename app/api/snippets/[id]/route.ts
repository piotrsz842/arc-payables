/**
 * GET /api/snippets/:id → a note snippet's full content, paid per request over x402.
 * (The free previews are at GET /api/snippets.)
 *
 * Stage 1–2: demo snippets from lib/demo-snippets.ts. Stage 3 reads the database.
 */
import { NextResponse, type NextRequest } from "next/server";
import { findSnippet } from "@/lib/demo-snippets";
import { requirePayment } from "@/lib/x402";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const snippet = findSnippet(id);
  // Check the snippet exists BEFORE asking for money, so nobody pays for a 404.
  if (!snippet) return NextResponse.json({ error: "No such snippet" }, { status: 404 });

  return requirePayment(
    req,
    { priceUsd: snippet.priceUsd, description: `Note snippet: ${snippet.title}` },
    (receipt) => NextResponse.json({ ...snippet, receipt }),
  );
}
