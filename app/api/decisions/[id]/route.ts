/**
 * The student's Approve / Skip click for a purchase the checker sent to them.
 * POST { answer: "approved" | "denied" }
 */
import { answerDecision } from "@/lib/approvals";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { answer?: string } | null;
  const answer = body?.answer;
  if (answer !== "approved" && answer !== "denied") return Response.json({ error: "Bad answer." }, { status: 400 });

  const ok = await answerDecision(db, user.id, Number(id), answer);
  if (!ok) return Response.json({ error: "This question isn't waiting for that answer anymore." }, { status: 409 });
  return Response.json({ ok: true });
}
