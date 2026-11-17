"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Spinner } from "@/app/submit-button";
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

const usd = (v: string) => `$${Number(v).toFixed(3)}`;

export function AskChat({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [answer, setAnswer] = useState<string | null>(null);
  const [done, setDone] = useState<Extract<TutorEvent, { type: "done" }> | null>(null);
  const [error, setError] = useState<"topup" | "failed" | null>(null);
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

  async function ask(ev: React.FormEvent) {
    ev.preventDefault();
    const q = question.trim();
    if (!q || running) return;
    setRunning(true);
    setAsked(q);
    setSteps([]);
    setAnswer(null);
    setDone(null);
    setError(null);
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q }) });
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
      setError("failed");
    } finally {
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

  return (
    <div className="space-y-4">
      <form onSubmit={ask} className="space-y-3">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          required
          disabled={running}
          placeholder={placeholder}
          className="w-full rounded border px-3 py-2 disabled:bg-slate-50"
        />
        <button disabled={running || !question.trim()} className="rounded bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-60">
          {running ? (
            <span className="inline-flex items-center gap-2">
              <Spinner /> Working…
            </span>
          ) : (
            "Ask"
          )}
        </button>
      </form>

      {error === "topup" && (
        <p className="rounded bg-red-50 p-3 text-sm text-red-700">
          You&apos;ve used your free questions and your balance is empty.{" "}
          <Link href="/" className="underline">Add money</Link> or upload notes to earn some.
        </p>
      )}
      {error === "failed" && <p className="rounded bg-red-50 p-3 text-sm text-red-700">Something went wrong. Please try again.</p>}

      {asked && !error && (
        <div className="space-y-4">
          <p className="rounded bg-slate-100 p-3 text-sm">{asked}</p>

          <ol className="space-y-2 text-sm">
            {steps.map((s, i) =>
              s.kind === "search" ? (
                <li key={i} className="text-slate-500">
                  🔎 Looked for notes on “{s.query}”{s.course ? ` in ${s.course}` : ""}: {s.found === 0 ? "nothing found" : `${s.found} found`}
                </li>
              ) : (
                <li key={i} className="rounded border bg-white p-3">
                  <div className="flex justify-between gap-3">
                    <span>
                      {!s.result && !s.approval && <Spinner />}
                      {s.result?.bought && "✓ "}
                      {s.result && !s.result.bought && "✗ "}
                      <span className="font-medium">{s.title}</span>
                      {s.result?.bought && <span className="text-slate-500"> by {s.result.authorName}</span>}
                    </span>
                    <span className={s.result?.bought ? "font-medium text-green-700" : "text-slate-400"}>{usd(s.priceUsd)}</span>
                  </div>
                  <p className="text-slate-500">Tutor: {s.reason}</p>
                  {!s.result && !s.approval && <p className="text-slate-400">Checking this purchase…</p>}
                  {s.result && !s.result.bought && <p className="text-red-700">Not bought: {s.result.why}</p>}
                  {s.approval?.state === "waiting" || s.approval?.state === "sending" ? (
                    <div className="mt-2 rounded bg-amber-50 p-2">
                      <p className="text-amber-900">Needs your OK: {s.approval.why}</p>
                      <div className="mt-2 flex gap-2">
                        <button
                          disabled={s.approval.state === "sending"}
                          onClick={() => answerApproval(s.approval!.logId, "approved")}
                          className="rounded bg-slate-900 px-3 py-1 text-white disabled:opacity-60"
                        >
                          Buy it ({usd(s.priceUsd)})
                        </button>
                        <button
                          disabled={s.approval.state === "sending"}
                          onClick={() => answerApproval(s.approval!.logId, "denied")}
                          className="rounded border px-3 py-1 disabled:opacity-60"
                        >
                          Skip
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-amber-800">The tutor waits up to 2 minutes, then skips it.</p>
                    </div>
                  ) : null}
                </li>
              ),
            )}
            {running && !answer && (
              <li className="flex items-center gap-2 text-slate-500">
                <Spinner /> {steps.length === 0 ? "Reading your question…" : "Thinking…"}
              </li>
            )}
          </ol>

          {answer && (
            <div className="rounded-lg border bg-white p-5">
              <Answer text={answer} />
            </div>
          )}

          {done && (
            <p className="text-sm">
              {done.free
                ? `Free question. Notes worth ${usd(done.spentUsd)} were covered by us.`
                : `This question cost ${usd(done.chargedUsd)}, paid from your balance.`}{" "}
              Every cent went to the students whose notes were used.{" "}
              <Link href={`/ask/${done.runId}`} className="underline">Receipt</Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Just enough formatting for the tutor's answers: paragraphs, **bold** and `code`. */
function Answer({ text }: { text: string }) {
  return (
    <div className="space-y-2 whitespace-pre-wrap">
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i}>
          {para.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, j) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong key={j}>{part.slice(2, -2)}</strong>
            ) : part.startsWith("`") && part.endsWith("`") ? (
              <code key={j} className="rounded bg-slate-100 px-1">{part.slice(1, -1)}</code>
            ) : (
              part.replace(/^#{1,6}\s+/gm, "")
            ),
          )}
        </p>
      ))}
    </div>
  );
}
