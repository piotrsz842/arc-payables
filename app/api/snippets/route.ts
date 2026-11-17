/**
 * GET /api/snippets → FREE previews of every snippet (title, course, one-line
 * summary, price). Never the content: that is what the agent pays for.
 * The agent reads these to decide what's worth buying.
 */
import { NextResponse } from "next/server";
import { DEMO_SNIPPETS, toPreview } from "@/lib/demo-snippets";

export function GET() {
  return NextResponse.json(DEMO_SNIPPETS.map(toPreview));
}
