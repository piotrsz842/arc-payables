/**
 * "Ask the student" on the web.
 *
 * When the checker says ask_human, the tutor run (one server request) waits
 * here while the student's page shows Approve / Skip. The student's click is
 * a SEPARATE request (POST /api/decisions/[id]) that writes the answer into
 * the decision log. The waiting run reads it from the database.
 *
 * Why the database and not memory: on Vercel the two requests can land on
 * different servers, so the log is the only place both can see.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HumanAnswer } from "./purchases";

export const APPROVAL_WAIT_SECONDS = 120;

/** Wait for the student's answer to one logged decision. "pending" = no answer in time. */
export async function waitForHumanAnswer(db: SupabaseClient, logId: number): Promise<HumanAnswer> {
  const deadline = Date.now() + APPROVAL_WAIT_SECONDS * 1000;
  while (Date.now() < deadline) {
    const { data } = await db.from("purchase_decisions").select("human_decision").eq("id", logId).single();
    if (data?.human_decision === "approved" || data?.human_decision === "denied") return data.human_decision;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return "pending";
}

/**
 * Record the student's answer. Only the person who asked the question, only
 * for a decision that is waiting for a person, only while the run is still going,
 * and only once (the update requires human_decision to still be empty).
 */
export async function answerDecision(
  db: SupabaseClient,
  userId: string,
  logId: number,
  answer: "approved" | "denied",
): Promise<boolean> {
  const { data: d } = await db
    .from("purchase_decisions")
    .select("verdict, human_decision, agent_runs(asked_by, status)")
    .eq("id", logId)
    .single();
  const run = d?.agent_runs as unknown as { asked_by: string; status: string } | null;
  if (!d || !run || run.asked_by !== userId || run.status !== "running") return false;
  if (d.verdict !== "ask_human" || d.human_decision) return false;

  const { data: updated } = await db
    .from("purchase_decisions")
    .update({ human_decision: answer })
    .eq("id", logId)
    .is("human_decision", null)
    .select("id");
  return (updated?.length ?? 0) > 0;
}
