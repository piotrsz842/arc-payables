/**
 * GET /api/snippets/:id → a snippet's full content, paid per request over x402
 * (Circle Gateway Nanopayments on Arc). The moment Gateway accepts the
 * payment, the sale is written to the author's ledger: their earnings go up
 * immediately, even though Gateway settles the batch onchain minutes later.
 */
import { NextResponse, type NextRequest } from "next/server";
import { recordSale } from "@/lib/ledger";
import { getSnippetWithContent } from "@/lib/snippets";
import { db } from "@/lib/supabase/admin";
import { requirePayment } from "@/lib/x402";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const snippet = await getSnippetWithContent(db, id);
  // Check the snippet exists BEFORE asking for money, so nobody pays for a 404.
  if (!snippet) return NextResponse.json({ error: "No such snippet" }, { status: 404 });

  return requirePayment(
    req,
    { priceUsd: snippet.priceUsd, description: `Note snippet: ${snippet.title}` },
    async (receipt) => {
      try {
        await recordSale(db, {
          authorId: snippet.authorId,
          snippetId: snippet.id,
          priceUsd: snippet.priceUsd,
          gatewayTransferId: receipt.transaction,
          payer: receipt.payer,
        });
      } catch (err) {
        // The buyer has already paid, so they still get the content. The sale
        // can be re-credited later from Gateway's transfer id.
        console.error(`SALE NOT RECORDED for transfer ${receipt.transaction}:`, err);
      }
      const { authorId: _authorId, ...publicSnippet } = snippet;
      return NextResponse.json({ ...publicSnippet, receipt });
    },
  );
}
