"use client";

import { Ban, Check, Layers, ListChecks, RotateCcw, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/app/submit-button";
import { Notice, usd } from "@/app/ui/notice";
import type { StudyKind, StudySet } from "@/lib/study";

const LENGTHS: Record<StudyKind, { label: string; count: number }[]> = {
  quiz: [
    { label: "Quick (5)", count: 5 },
    { label: "Practice (10)", count: 10 },
    { label: "Test (20)", count: 20 },
  ],
  flashcards: [
    { label: "8 cards", count: 8 },
    { label: "15 cards", count: 15 },
  ],
};

export function StudyClient({ freeLeft }: { freeLeft: number }) {
  const router = useRouter();
  const [kind, setKind] = useState<StudyKind>("quiz");
  const [course, setCourse] = useState("CPSC 221");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [set, setSet] = useState<StudySet | null>(null);
  const abort = useRef<AbortController | null>(null);
  // Leaving the page cancels a set that is still being made (no charge).
  useEffect(() => () => abort.current?.abort(), []);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return setError("Pick a topic first.");
    setLoading(true);
    setError(null);
    setSet(null);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const res = await fetch("/api/study", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ course, topic, kind, count }), signal: controller.signal });
      const body = await res.json();
      if (!res.ok) setError(body.error === "topup" ? "topup" : body.error ?? "Something went wrong.");
      else setSet(body as StudySet);
    } catch {
      // Cancel pressed: the server stops buying and charges nothing.
      setError(controller.signal.aborted ? "Cancelled. You weren't charged." : "Something went wrong. Please try again.");
    } finally {
      abort.current = null;
      setLoading(false);
      router.refresh();
    }
  }

  if (set) return <StudySetView set={set} onRestart={() => setSet(null)} />;

  return (
    <form onSubmit={start} className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {([
          { k: "quiz", icon: ListChecks, title: "Practice quiz", body: "Multiple choice with explanations" },
          { k: "flashcards", icon: Layers, title: "Flashcards", body: "Flip to see the answer" },
        ] as const).map(({ k, icon: Icon, title, body }) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k);
              setCount(LENGTHS[k][0].count);
            }}
            className={`card p-4 text-left transition ${kind === k ? "border-brand-500 ring-4 ring-brand-100" : "hover:border-black/15"}`}
          >
            <Icon className={kind === k ? "text-brand-600" : "text-black/40"} aria-hidden />
            <div className="mt-2 font-semibold">{title}</div>
            <div className="text-sm text-black/55">{body}</div>
          </button>
        ))}
      </div>

      <div className="card space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Course</span>
            <input value={course} onChange={(e) => setCourse(e.target.value)} className="field" placeholder="CPSC 221" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Topic</span>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} className="field" placeholder="quicksort, heaps, hash tables…" required />
          </label>
        </div>
        <div className="space-y-1 text-sm">
          <span className="font-medium">Length</span>
          <div className="flex flex-wrap gap-2">
            {LENGTHS[kind].map((l) => (
              <button
                key={l.count}
                type="button"
                onClick={() => setCount(l.count)}
                className={`rounded-full border px-3 py-1.5 ${count === l.count ? "border-brand-500 bg-brand-50 text-brand-700" : "border-black/10 bg-white"}`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <button disabled={loading} className="btn-primary w-full sm:w-auto">
          {loading ? (
            <>
              <Spinner /> Finding study guides and writing your {kind}…
            </>
          ) : (
            <>
              <Sparkles size={16} aria-hidden /> Make my {kind === "quiz" ? "quiz" : "flashcards"}
            </>
          )}
        </button>
        {loading ? (
          <button type="button" onClick={() => abort.current?.abort()} className="btn-secondary w-full sm:w-auto">
            Cancel
          </button>
        ) : (
          <Link href="/" className="btn-secondary w-full sm:w-auto">
            Cancel
          </Link>
        )}
        </div>
        <p className="text-xs text-black/45">
          Uses {freeLeft > 0 ? "one of your free questions" : "your balance (at most $0.01)"}. Study guides you already bought are reused for free; new
          ones are checked first, then paid to their authors.
        </p>
      </div>

      {error === "topup" ? (
        <Notice kind="error">
          You&apos;ve used your free questions and your balance is empty. <Link href="/earnings" className="font-semibold underline">Add money</Link>.
        </Notice>
      ) : (
        error && <Notice kind={error.startsWith("Cancelled") ? "info" : "error"}>{error}</Notice>
      )}
    </form>
  );
}

function StudySetView({ set, onRestart }: { set: StudySet; onRestart: () => void }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">
          {set.kind === "quiz" ? "Quiz" : "Flashcards"}: {set.topic}
        </h2>
        <div className="flex gap-2">
          <button onClick={onRestart} className="btn-secondary px-3 py-2">
            <RotateCcw size={16} aria-hidden /> New set
          </button>
          <Link href="/" className="btn-secondary px-3 py-2">
            <X size={16} aria-hidden /> Quit
          </Link>
        </div>
      </div>
      {set.quiz && <Quiz items={set.quiz} />}
      {set.cards && <Cards cards={set.cards} />}
      <Sources set={set} />
    </div>
  );
}

function Quiz({ items }: { items: NonNullable<StudySet["quiz"]> }) {
  const [picked, setPicked] = useState<(number | null)[]>(items.map(() => null));
  const [checked, setChecked] = useState(false);
  const score = items.filter((q, i) => picked[i] === q.answer).length;
  return (
    <div className="space-y-4">
      {checked && (
        <div className="card flex items-center justify-between p-5">
          <span className="font-semibold">Your score</span>
          <span className="text-2xl font-extrabold">
            {score} / {items.length}
          </span>
        </div>
      )}
      {items.map((q, i) => (
        <div key={i} className="card space-y-3 p-5">
          <div className="font-semibold">
            {i + 1}. {q.question}
          </div>
          <div className="space-y-2">
            {q.options.map((o, j) => {
              const isPicked = picked[i] === j;
              const right = checked && j === q.answer;
              const wrong = checked && isPicked && j !== q.answer;
              return (
                <button
                  key={j}
                  type="button"
                  disabled={checked}
                  onClick={() => setPicked((p) => p.map((v, k) => (k === i ? j : v)))}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${
                    right ? "border-emerald-400 bg-emerald-50" : wrong ? "border-red-300 bg-red-50" : isPicked ? "border-brand-500 bg-brand-50" : "border-black/10 hover:border-black/20"
                  }`}
                >
                  {o}
                  {right && <Check size={16} className="text-emerald-600" aria-hidden />}
                  {wrong && <X size={16} className="text-red-600" aria-hidden />}
                </button>
              );
            })}
          </div>
          {checked && (
            <p className="text-sm text-black/65">
              {q.explanation}{" "}
              <span className="ml-1 inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">{q.source}</span>
            </p>
          )}
        </div>
      ))}
      {!checked && (
        <button onClick={() => setChecked(true)} disabled={picked.some((p) => p === null)} className="btn-primary w-full">
          {picked.some((p) => p === null) ? `Answer all ${items.length} questions` : "Check my answers"}
        </button>
      )}
    </div>
  );
}

function Cards({ cards }: { cards: NonNullable<StudySet["cards"]> }) {
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((c, i) => {
        const open = flipped.has(i);
        return (
          <button
            key={i}
            type="button"
            onClick={() => setFlipped((f) => { const n = new Set(f); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
            className={`card flex min-h-36 flex-col justify-between p-5 text-left transition ${open ? "border-brand-200 bg-brand-50/40" : "hover:border-black/15"}`}
          >
            <div className={open ? "text-sm" : "font-semibold"}>{open ? c.back : c.front}</div>
            <div className="mt-3 flex items-center justify-between text-xs text-black/45">
              <span>{open ? <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">{c.source}</span> : "Tap to flip"}</span>
              <span>{i + 1}/{cards.length}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Sources({ set }: { set: StudySet }) {
  const bought = set.sources.filter((s) => s.how === "bought");
  return (
    <div className="card space-y-2 p-5 text-sm">
      <div className="font-semibold">Built from these study guides</div>
      <ul className="space-y-1.5">
        {set.sources.map((s, i) => (
          <li key={i} className="flex items-start justify-between gap-3">
            <span className="flex items-start gap-1.5">
              {s.how === "skipped" ? <Ban size={15} className="mt-0.5 text-black/35" aria-hidden /> : <Check size={15} className="mt-0.5 text-emerald-600" aria-hidden />}
              <span>
                <span className={s.how === "skipped" ? "text-black/45" : ""}>{s.title}</span> <span className="text-black/45">by {s.authorName}</span>
                {s.how === "skipped" && <span className="block text-xs text-black/45">Skipped: {s.why}</span>}
              </span>
            </span>
            <span className="shrink-0 text-xs">
              {s.how === "bought" && <span className="font-semibold text-emerald-700">{usd(s.priceUsd)}</span>}
              {s.how === "reused" && <span className="text-black/45">already yours, free</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="pt-1 text-xs text-black/45">
        {set.free ? "Free question." : `This set cost ${usd(set.chargedUsd)}.`}{" "}
        {bought.length > 0 && `${bought.length} new study guide${bought.length === 1 ? "" : "s"} paid to their authors.`}{" "}
        <Link href={`/ask/${set.runId}`} className="underline">Receipt</Link>
      </p>
    </div>
  );
}
