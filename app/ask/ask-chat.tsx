"use client";

import { ArrowUp, Ban, Check, Search, Square, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/app/submit-button";
import { AnswerMarkdown } from "@/app/ui/markdown";
import { Notice, usd } from "@/app/ui/notice";
import type { TutorEvent } from "@/lib/tutor";

type StreamEvent = TutorEvent | { type: "error"; code: "topup" | "failed" };

// One line in the live activity list.
type Step =
  | { kind: "search"; query: string; course?: string; found: number }
  | {
      kind: "note";
      snippetId: string;
      title: string;
      priceUsd: string;
      reason: string;
      result?: { bought: true; authorName: string } | { bought: false; why: string };
      approval?: { logId: number; why: string; state: "waiting" | "sending" | "approved" | "denied" | "pending" };
    };

type NoteStep = Extract<Step, { kind: "note" }>;

export function AskChat({ placeholder, initialQuestion, examples = [] }: { placeholder: string; initialQuestion?: string; examples?: string[] }) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [answer, setAnswer] = useState<string | null>(null);
  const [done, setDone] = useState<Extract<TutorEvent, { type: "done" }> | null>(null);
  const [error, setError] = useState<"topup" | "failed" | null>(null);
  const [stopped, setStopped] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const [asked, setAsked] = useState("");

  // Change the last "note" step for this snippet (or this approval).
  const updateNote = (match: (s: Extract<Step, { kind: "note" }>) => boolean, change: (s: Extract<Step, { kind: "note" }>) => Step) =>
    setSteps((all) => {
      let i = all.length - 1;
      while (i >= 0 && !(all[i].kind === "note" && match(all[i] as Extract<Step, { kind: "note" }>))) i--;
      if (i < 0) return all;
      const copy = [...all];
      copy[i] = change(copy[i] as Extract<Step, { kind: "note" }>);
      return copy;
    });

  function handle(e: StreamEvent) {
    switch (e.type) {
      case "search":
        setSteps((all) => [...all, { kind: "search", query: e.query, course: e.course, found: e.found }]);
        break;
      case "checking":
        setSteps((all) => [...all, { kind: "note", snippetId: e.snippetId, title: e.title, priceUsd: e.priceUsd, reason: e.reason }]);
        break;
      case "needs_approval":
        updateNote((s) => s.title === e.title && !s.result, (s) => ({ ...s, approval: { logId: e.logId, why: e.why, state: "waiting" } }));
        break;
      case "approval_result":
        updateNote((s) => s.approval?.logId === e.logId, (s) => ({ ...s, approval: { ...s.approval!, state: e.answer } }));
        break;
      case "bought":
        updateNote((s) => s.snippetId === e.snippetId && !s.result, (s) => ({ ...s, result: { bought: true, authorName: e.authorName } }));
        break;
      case "not_bought":
        updateNote((s) => s.snippetId === e.snippetId && !s.result, (s) => ({ ...s, result: { bought: false, why: e.why } }));
        break;
      case "answer":
        setAnswer(e.text);
        break;
      case "done":
        setDone(e);
        break;
      case "error":
        setError(e.code);
        break;
    }
  }

  async function run(text: string) {
    const q = text.trim();
    if (!q || running) return;
    setRunning(true);
    setAsked(q);
    setSteps([]);
    setAnswer(null);
    setDone(null);
    setError(null);
    setStopped(false);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q }), signal: controller.signal });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      // Read the stream line by line: each line is one event.
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      while (true) {
        const { value, done: finished } = await reader.read();
        if (finished) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) handle(JSON.parse(line) as StreamEvent);
      }
    } catch {
      // Stop pressed: the server sees the request end, buys nothing more and charges nothing.
      if (controller.signal.aborted) setStopped(true);
      else setError("failed");
    } finally {
      abort.current = null;
      setRunning(false);
      setQuestion("");
      router.refresh(); // free questions / balance changed
    }
  }

  async function answerApproval(logId: number, answer: "approved" | "denied") {
    updateNote((s) => s.approval?.logId === logId, (s) => ({ ...s, approval: { ...s.approval!, state: "sending" } }));
    const res = await fetch(`/api/decisions/${logId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    });
    // On success the tutor reports the result itself (approval_result); on failure, show the buttons again.
    if (!res.ok) updateNote((s) => s.approval?.logId === logId, (s) => ({ ...s, approval: { ...s.approval!, state: "waiting" } }));
  }

  function stop() {
    abort.current?.abort();
  }

  // Leaving the page stops the question too (no charge).
  useEffect(() => () => abort.current?.abort(), []);

  // A question typed on the home screen arrives as ?q=… and starts right away (once).
  const started = useRef(false);
  useEffect(() => {
    if (initialQuestion && !started.current) {
      started.current = true;
      void run(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  const notes = steps.filter((s): s is NoteStep => s.kind === "note");
  const bought = notes.filter((s) => s.result?.bought);
  const skipped = notes.filter((s) => s.result && !s.result.bought);
  const waiting = notes.filter((s) => s.approval && (s.approval.state === "waiting" || s.approval.state === "sending"));
  const spent = bought.reduce((sum, s) => sum + Number(s.priceUsd), 0);
  const searches = steps.filter((s) => s.kind === "search");

  return (
    <div className="space-y-5">
      {!asked && examples.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-black/50">Try one of these</p>
          <div className="flex flex-wrap gap-2">
            {examples.map((ex) => (
              <button key={ex} type="button" onClick={() => setQuestion(ex)} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm hover:border-brand-200 hover:bg-brand-50">
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {error === "topup" && (
        <Notice kind="error">
          You&apos;ve used your free questions and your balance is empty. <Link href="/earnings" className="font-semibold underline">Add money</Link> or upload a study guide to earn some.
        </Notice>
      )}
      {error === "failed" && <Notice kind="error">Something went wrong. Please try again.</Notice>}

      {asked && !error && (
        <div className="space-y-4">
          <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-white">{asked}</div>

          {/* At a glance: what the tutor used, skipped, and is checking. Tap for the details. */}
          {(notes.length > 0 || searches.length > 0) && (
            <details className="group">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 text-sm">
                {searches.length > 0 && notes.length === 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-3 py-1 text-black/60"><Search size={14} aria-hidden /> Looked through study guides</span>
                )}
                {bought.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-800">
                    <Check size={14} aria-hidden /> Used {bought.length} study guide{bought.length === 1 ? "" : "s"} · {usd(spent)}
                  </span>
                )}
                {skipped.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-3 py-1 text-black/60"><Ban size={14} aria-hidden /> Skipped {skipped.length}</span>
                )}
                {notes.some((s) => !s.result && !s.approval) && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-brand-700"><Spinner /> Checking</span>
                )}
                <span className="text-xs text-black/40 group-open:hidden">Details</span>
                <span className="hidden text-xs text-black/40 group-open:inline">Hide details</span>
              </summary>
              <ol className="mt-3 space-y-2 text-sm">
                {steps.map((s, i) =>
                  s.kind === "search" ? (
                    <li key={i} className="flex items-center gap-2 text-black/50">
                      <Search size={14} aria-hidden /> Looked for “{s.query}”{s.course ? ` in ${s.course}` : ""}: {s.found === 0 ? "nothing found" : `${s.found} found`}
                    </li>
                  ) : (
                    <li key={i} className="rounded-xl border border-black/5 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex items-center gap-1.5 font-medium">
                          {!s.result && <Spinner />}
                          {s.result?.bought && <Check size={15} className="text-emerald-600" aria-hidden />}
                          {s.result && !s.result.bought && <Ban size={15} className="text-black/40" aria-hidden />}
                          {s.title}
                        </span>
                        <span className={s.result?.bought ? "font-semibold text-emerald-700" : "text-black/40"}>{usd(s.priceUsd)}</span>
                      </div>
                      {s.result?.bought && <p className="text-xs text-black/50">by {s.result.authorName}</p>}
                      <p className="mt-1 text-black/55">Why the tutor wanted it: {s.reason}</p>
                      {s.result && !s.result.bought && <p className="mt-1 text-black/70">Skipped: {s.result.why}</p>}
                      {s.result?.bought && <Link href={`/report/${s.snippetId}`} className="mt-1 inline-block text-xs text-black/40 underline">Report this section</Link>}
                    </li>
                  ),
                )}
              </ol>
            </details>
          )}

          {/* Approvals are always visible, never hidden in the details. */}
          {waiting.map((s) => (
            <div key={s.approval!.logId} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="font-semibold text-amber-950">Use “{s.title}” for {usd(s.priceUsd)}?</div>
              <p className="mt-0.5 text-sm text-amber-900">{s.approval!.why}</p>
              <div className="mt-3 flex gap-2">
                <button disabled={s.approval!.state === "sending"} onClick={() => answerApproval(s.approval!.logId, "approved")} className="btn-primary px-4 py-2">Buy it</button>
                <button disabled={s.approval!.state === "sending"} onClick={() => answerApproval(s.approval!.logId, "denied")} className="btn-secondary px-4 py-2">Skip</button>
              </div>
              <p className="mt-2 text-xs text-amber-800">The tutor waits up to 2 minutes, then skips it.</p>
            </div>
          ))}

          {running && !answer && (
            <div className="flex items-center gap-2 text-sm text-black/50">
              <Spinner /> {steps.length === 0 ? "Reading your question…" : waiting.length ? "Waiting for your answer…" : "Thinking…"}
              <button type="button" onClick={stop} className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-black/70 hover:bg-black/5">
                <Square size={12} aria-hidden /> Stop
              </button>
            </div>
          )}

          {stopped && !answer && <Notice kind="info">Stopped. You weren&apos;t charged for this question.</Notice>}

          {answer && !stopped && (
            <div className="card p-5">
              <AnswerMarkdown text={answer} />
            </div>
          )}

          {done && !stopped && (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-black/55">
              <span>
                {done.free ? "Free question." : `This question cost ${usd(done.chargedUsd)}.`}{" "}
                {Number(done.spentUsd) > 0 && `${usd(done.spentUsd)} went to the students whose guides were used.`}{" "}
                <Link href={`/ask/${done.runId}`} className="underline">Receipt</Link>
              </span>
              <RateAnswer runId={done.runId} />
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(question);
        }}
        className="card sticky bottom-20 flex items-end gap-2 p-2 md:bottom-4"
      >
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void run(question);
            }
          }}
          rows={2}
          disabled={running}
          placeholder={placeholder}
          className="min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] outline-none placeholder:text-black/35"
        />
        {running ? (
          <button type="button" onClick={stop} className="btn-secondary px-3" aria-label="Stop">
            <Square size={16} aria-hidden />
          </button>
        ) : (
          <button disabled={!question.trim()} className="btn-primary px-3" aria-label="Ask">
            <ArrowUp size={18} aria-hidden />
          </button>
        )}
      </form>
    </div>
  );
}

/** Thumbs up / down for this answer. It counts toward the authors whose sections were used. */
function RateAnswer({ runId }: { runId: string }) {
  const [sent, setSent] = useState<1 | -1 | null>(null);
  async function rate(rating: 1 | -1) {
    const res = await fetch("/api/ratings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId, rating }) });
    if (res.ok) setSent(rating);
  }
  if (sent) return <span className="text-black/50">Thanks for the feedback</span>;
  return (
    <span className="flex items-center gap-1">
      <span className="mr-1">Helpful?</span>
      <button onClick={() => rate(1)} className="rounded-lg p-1.5 hover:bg-black/5" aria-label="Helpful"><ThumbsUp size={16} aria-hidden /></button>
      <button onClick={() => rate(-1)} className="rounded-lg p-1.5 hover:bg-black/5" aria-label="Not helpful"><ThumbsDown size={16} aria-hidden /></button>
    </span>
  );
}
