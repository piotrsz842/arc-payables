import { Ban, Check, Clock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnswerMarkdown } from "@/app/ui/markdown";
import { usd } from "@/app/ui/notice";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { getRunReceipt } from "@/lib/tutor";

export const dynamic = "force-dynamic";

/** The receipt for one question: the answer, which study guides were used and why, what was skipped, what it cost. */
export default async function AnswerPage({ params }: { params: Promise<{ runId: string }> }) {
  const user = await requireUser();
  const { runId } = await params;
  const { run, decisions } = await getRunReceipt(db, runId);
  if (!run || run.asked_by !== user.id) notFound(); // only the asker sees their question

  const used = decisions.filter((d) => d.paid);
  const blocked = decisions.filter((d) => d.verdict === "block" || d.human_decision === "denied");
  // Needed the student's OK but got no answer before the tutor moved on.
  const waiting = decisions.filter((d) => d.verdict === "ask_human" && !d.human_decision);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-white">{run.question}</div>
      <div className="card p-5">{run.answer ? <AnswerMarkdown text={run.answer} /> : "Still working…"}</div>

      <section className="card space-y-3 p-5 text-sm">
        <h2 className="text-base font-bold">Study guides used</h2>
        {used.length === 0 && <p className="text-black/50">None for this question.</p>}
        {used.map((d) => (
          <div key={d.id} className="space-y-0.5">
            <div className="flex items-start justify-between gap-3">
              <span className="flex items-center gap-1.5 font-semibold"><Check size={15} className="text-emerald-600" aria-hidden /> {d.title}</span>
              <span className="shrink-0 font-semibold text-emerald-700">{usd(d.price_usd)}</span>
            </div>
            <p className="pl-5 text-black/55">by {d.authorName ?? "a student"} · why: {d.agent_reason}</p>
            <Link href={`/report/${d.snippet_id}`} className="pl-5 text-xs text-black/40 underline">Report this section</Link>
          </div>
        ))}

        {waiting.length > 0 && <h3 className="pt-2 font-semibold">Skipped (needed your OK, no answer in time)</h3>}
        {waiting.map((d) => (
          <p key={d.id} className="flex items-start gap-1.5 text-black/60"><Clock size={15} className="mt-0.5" aria-hidden /> {d.title} · {usd(d.price_usd)}</p>
        ))}

        {blocked.length > 0 && <h3 className="pt-2 font-semibold">Not bought</h3>}
        {blocked.map((d) => (
          <div key={d.id}>
            <p className="flex items-center gap-1.5 text-black/70"><Ban size={15} className="text-black/40" aria-hidden /> {d.title}</p>
            <p className="pl-5 text-black/50">{d.human_decision === "denied" ? "You said no." : d.checker_reason}</p>
          </div>
        ))}

        <p className="border-t border-black/5 pt-3 font-semibold">
          {run.free_question ? `Free question. Study guides worth ${usd(run.spent_usd)} were covered by us.` : `This question cost ${usd(run.charged_usd)}.`}
        </p>
      </section>

      <details className="text-xs text-black/50">
        <summary className="cursor-pointer">Details</summary>
        <div className="mt-2 space-y-1">
          <p>Each study guide was bought with an x402 nanopayment through Circle Gateway on the Arc test network.</p>
          {used.map((d) => (
            <p key={d.id} className="break-all font-mono">{d.title}: Gateway transfer {d.gateway_transfer_id}</p>
          ))}
          <p>Question {run.id}</p>
          {process.env.TUTOR_AGENT_ID && (
            <p>
              The tutor has an on-chain identity on Arc: ERC-8004 agent #{process.env.TUTOR_AGENT_ID}. After each question the checker records how many of its
              purchase proposals passed, as reputation (tag “purchase_discipline”). <a className="underline" href="/agent.json" target="_blank">Agent profile</a>
            </p>
          )}
        </div>
      </details>

      <Link href="/ask" className="btn-primary">Ask another question</Link>
    </div>
  );
}
