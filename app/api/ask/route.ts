/**
 * Ask the tutor, live. POST { question } → a stream of JSON lines, one per
 * step (searching, checking a note, bought, not bought, needs your OK, answer,
 * done). The page reads them as they arrive, so the student watches the agent
 * work and spend instead of staring at a spinner.
 */
import { waitForHumanAnswer } from "@/lib/approvals";
import { getCurrentUser } from "@/lib/auth";
import { siteUrl } from "@/lib/site-url";
import { db } from "@/lib/supabase/admin";
import { askTutor, NeedsTopUpError, type TutorEvent } from "@/lib/tutor";

// Several model calls, payments, and possibly a 2-minute wait for the student.
export const maxDuration = 300;

type StreamEvent = TutorEvent | { type: "error"; code: "topup" | "failed" };

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { question?: string } | null;
  const question = String(body?.question ?? "").trim().slice(0, 2000);
  if (!question) return Response.json({ error: "Please type a question." }, { status: 400 });
  const baseUrl = await siteUrl();

  const encoder = new TextEncoder();
  // Stop: the page aborts the request (or the student leaves). Then: no more purchases, no charge.
  let stopped = false;
  req.signal.addEventListener("abort", () => (stopped = true));
  const stream = new ReadableStream({
    cancel() {
      stopped = true;
    },
    async start(controller) {
      let open = true;
      const send = (event: StreamEvent) => {
        if (!open) return; // the student closed the page; the run still finishes and is charged correctly
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          open = false;
        }
      };

      try {
        await askTutor({
          db,
          baseUrl,
          user,
          question,
          onEvent: send,
          shouldStop: () => stopped,
          // The checker wants a person: show Approve / Skip and wait for the click.
          askHuman: async (preview, decision, logId) => {
            send({ type: "needs_approval", logId, title: preview.title, priceUsd: preview.priceUsd, why: decision.reason });
            const answer = await waitForHumanAnswer(db, logId, () => stopped);
            send({ type: "approval_result", logId, answer });
            return answer;
          },
        });
      } catch (err) {
        if (!(err instanceof NeedsTopUpError)) console.error("Ask failed:", err);
        send({ type: "error", code: err instanceof NeedsTopUpError ? "topup" : "failed" });
      } finally {
        if (open) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
