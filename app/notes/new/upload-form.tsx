"use client";

import { FileText, Pencil, Wand2 } from "lucide-react";
import { useState } from "react";
import { SubmitButton, Spinner } from "@/app/submit-button";
import { Notice } from "@/app/ui/notice";
import { uploadNote } from "./actions";

type Section = { title: string; text: string };
const hasHeadings = (text: string) => /^#{1,6}\s+\S/m.test(text);
const toMarkdown = (sections: Section[]) => sections.map((s) => `# ${s.title.trim() || "Section"}\n\n${s.text.trim()}`).join("\n\n");

const TEMPLATE = `# First topic
Explain it the way you'd explain it to a classmate.

Worked example: …

Exam tip: …

# Second topic
…`;

/**
 * Upload a study guide. Files (.docx, .pdf, .txt, .md) become editable text.
 * Text without # headings is split into topics by Claude (the author's own
 * words, cut at topic boundaries) and shown for review before publishing.
 */
export function UploadForm() {
  const [body, setBody] = useState("");
  const [sections, setSections] = useState<Section[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function readFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setSections(null);
    const name = file.name.toLowerCase();
    if (name.endsWith(".txt") || name.endsWith(".md")) return setBody(await file.text());
    setBusy(`Reading ${file.name}…`);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/notes/extract", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "We couldn't read that file.");
      setBody(data.text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    // Already reviewing sections, or the guide has its own headings: submit normally.
    if (sections || hasHeadings(body)) return;
    e.preventDefault();
    if (!body.trim()) return setError("Add your study guide first.");
    setError(null);
    setBusy("Finding the topics in your study guide…");
    try {
      const res = await fetch("/api/notes/sections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: body }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setSections(data.sections);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <form action={uploadNote} onSubmit={onSubmit} className="card space-y-4 p-5">
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Course</span>
          <input name="course" placeholder="CPSC 221" required className="field" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Title</span>
          <input name="title" placeholder="Sorting algorithms" required className="field" />
        </label>
      </div>

      {sections ? (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3 rounded-xl bg-brand-50/60 p-3 text-sm">
            <span className="flex items-start gap-2">
              <Wand2 size={16} className="mt-0.5 shrink-0 text-brand-600" aria-hidden />
              We split your study guide into {sections.length} {sections.length === 1 ? "section" : "sections"} by topic, using your own words. Check the titles and where each one starts, then publish.
            </span>
            <button type="button" onClick={() => setSections(null)} className="flex shrink-0 items-center gap-1 font-semibold text-brand-700">
              <Pencil size={14} aria-hidden /> Edit text
            </button>
          </div>
          {sections.map((s, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-black/10 p-3">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-semibold text-black/50">Section {i + 1} title</span>
                <input
                  value={s.title}
                  onChange={(e) => setSections((all) => all!.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))}
                  className="field"
                />
              </label>
              <textarea
                value={s.text}
                onChange={(e) => setSections((all) => all!.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))}
                rows={Math.min(12, Math.max(4, Math.ceil(s.text.length / 90)))}
                className="field text-sm"
              />
            </div>
          ))}
          {/* What gets published: the reviewed sections as "# Title" headings. */}
          <input type="hidden" name="body" value={toMarkdown(sections)} />
        </div>
      ) : (
        <>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Your study guide</span>
            <textarea name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={14} placeholder={TEMPLATE} className="field font-mono text-sm" />
            <span className="mt-1 block text-xs text-black/45">
              Paste from Google Docs or anywhere. No headings? We&apos;ll find the topics and show you the sections before publishing.
            </span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 flex items-center gap-1 font-medium"><FileText size={14} aria-hidden /> …or upload a file (.docx, .pdf, .txt, .md)</span>
            <input
              type="file"
              accept=".docx,.pdf,.txt,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,text/plain,text/markdown"
              onChange={(e) => readFile(e.target.files?.[0])}
              className="block text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-semibold file:text-brand-700"
            />
          </label>
        </>
      )}

      {error && <Notice kind="error">{error}</Notice>}

      <label className="flex items-start gap-3 rounded-xl bg-brand-50/60 p-3 text-sm">
        <input name="own_work" type="checkbox" required className="mt-1 h-4 w-4" />
        <span>This is my own work in my own words. It doesn&apos;t copy slides, handouts, or lecture text word for word, and isn&apos;t AI output.</span>
      </label>
      {busy ? (
        <div className="btn-primary w-full opacity-80"><Spinner /> {busy}</div>
      ) : (
        <SubmitButton pendingText="Splitting into sections, writing previews, checking for copies…" className="btn-primary w-full">
          {sections || hasHeadings(body) ? "Publish study guide" : "Continue"}
        </SubmitButton>
      )}
      <p className="text-center text-xs text-black/45">Publishing takes about 10–30 seconds.</p>
    </form>
  );
}
