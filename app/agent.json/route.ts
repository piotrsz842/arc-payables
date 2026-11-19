/**
 * The tutor agent's public ERC-8004 metadata (its registration's metadataURI
 * points here). Anyone, including other agents, can read who it is, which
 * wallet it pays from, and the rules it follows.
 */
import { siteUrl } from "@/lib/site-url";

export async function GET() {
  const base = await siteUrl();
  return Response.json({
    name: "NoteWorth tutor",
    description:
      "An AI course tutor that buys short study-guide sections written by students, paying each author over x402 (Circle Gateway Nanopayments on Arc). A separate checker reviews every purchase before any money moves.",
    agent_type: "tutor",
    version: "1.0",
    capabilities: ["course-tutoring", "x402-buyer", "checked-purchases"],
    wallet: process.env.AGENT_ADDRESS ?? null,
    endpoints: { previews: `${base}/api/snippets?q=`, sections: `${base}/api/snippets/{id}` },
    spending_rules: { max_per_section_usd: "0.01", approval_above_usd: "0.005", max_per_question_usd: "0.01", max_proposals_per_question: 6 },
    reputation: { tag: "purchase_discipline", meaning: "Share of the tutor's purchase proposals that passed the independent checker, per question (0-100)." },
  });
}
