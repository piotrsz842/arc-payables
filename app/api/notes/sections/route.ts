/** Propose sections for a study guide without headings. POST { text } → { sections: [{ title, text }] } */
import { getCurrentUser } from "@/lib/auth";
import { proposeSections } from "@/lib/sectioning";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!(await getCurrentUser())) return Response.json({ error: "Please sign in." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = String(body?.text ?? "").trim();
  if (!text) return Response.json({ error: "Add your study guide first." }, { status: 400 });
  if (text.length > 60_000) return Response.json({ error: "That's too long. Upload one study guide at a time." }, { status: 400 });
  try {
    return Response.json({ sections: await proposeSections(text) });
  } catch (err) {
    console.error("Sectioning failed:", err);
    return Response.json({ error: "We couldn't split that automatically. Add # headings yourself, or try again." }, { status: 500 });
  }
}
