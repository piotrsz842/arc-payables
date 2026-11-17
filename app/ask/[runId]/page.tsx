import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { getRunReceipt } from "@/lib/tutor";

export const dynamic = "force-dynamic";

const cents = (usd: number | string) => `$${Number(usd).toFixed(3)}`;

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
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-lg border bg-white p-6">
        <p className="text-sm text-slate-500">{run.question}</p>
        <div className="mt-3 whitespace-pre-wrap">{run.answer ?? "Still working…"}</div>
      </div>

      <section className="space-y-2 text-sm">
        <h2 className="font-semibold">Notes used</h2>
        {used.length === 0 && <p className="text-slate-500">None.</p>}
        {used.map((d) => (
          <p key={d.id}>
            ✓ <span className="font-medium">{d.title}</span> by {d.authorName ?? "a student"} · {cents(d.price_usd)}
            <span className="block pl-4 text-slate-500">Why: {d.agent_reason}</span>
          </p>
        ))}

        {waiting.length > 0 && <h2 className="pt-2 font-semibold">Skipped (needed your OK, no answer in time)</h2>}
        {waiting.map((d) => (
          <p key={d.id}>
            – <span className="font-medium">{d.title}</span> · {cents(d.price_usd)}
            <span className="block pl-4 text-slate-500">{d.checker_reason}</span>
          </p>
        ))}

        {blocked.length > 0 && <h2 className="pt-2 font-semibold">Not bought</h2>}
        {blocked.map((d) => (
          <p key={d.id}>
            ✗ <span className="font-medium">{d.title}</span>
            <span className="block pl-4 text-slate-500">{d.checker_reason}</span>
          </p>
        ))}

        <p className="pt-2 font-medium">
          {run.free_question ? `Free question (notes worth ${cents(run.spent_usd)} covered by us)` : `This question cost ${cents(run.charged_usd)}`}
        </p>
      </section>

      <details className="rounded border bg-white p-3 text-xs text-slate-500">
        <summary className="cursor-pointer">Details</summary>
        <p className="mt-2">Each note was bought with an x402 nanopayment through Circle Gateway on the Arc test network.</p>
        {used.map((d) => (
          <p key={d.id} className="font-mono">{d.title}: Gateway transfer {d.gateway_transfer_id}</p>
        ))}
        <p className="mt-1">Run {run.id}</p>
      </details>

      <Link href="/ask" className="inline-block rounded bg-slate-900 px-4 py-2 font-medium text-white">Ask another question</Link>
    </div>
  );
}
