"use client";

import { AlertTriangle, Camera, Check, PenLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Spinner } from "@/app/submit-button";
import { Notice } from "@/app/ui/notice";

type Page = { path: string; url: string | null; text: string; legibility: "good" | "fair" | "poor"; issues: string[]; darkPhoto: boolean };

const ISSUE_WORDS: Record<string, string> = {
  blurry: "blurry",
  too_dark: "too dark",
  cut_off: "part of the page is cut off",
  glare: "glare on the page",
  messy_handwriting: "hard-to-read handwriting",
  not_notes: "doesn't look like study notes",
};
const MAX_PAGES = 6;

/** Shrink a phone photo in the browser (long side 1568 px, JPEG) so uploads stay small and fast. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1568 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("resize failed"))), "image/jpeg", 0.85));
}

export function HandwrittenClient() {
  const router = useRouter();
  const [course, setCourse] = useState("");
  const [title, setTitle] = useState("");
  const [pages, setPages] = useState<Page[]>([]);
  const [reading, setReading] = useState<string | null>(null);
  const [ownWork, setOwnWork] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const list = [...files].slice(0, MAX_PAGES - pages.length);
    for (const [i, file] of list.entries()) {
      setReading(`Reading page ${pages.length + i + 1}${list.length > 1 ? ` (${i + 1} of ${list.length})` : ""}…`);
      try {
        const form = new FormData();
        form.append("photo", await shrink(file), "page.jpg");
        const res = await fetch("/api/handwritten/transcribe", { method: "POST", body: form });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "We couldn't read that photo.");
        setPages((p) => [...p, body as Page]);
      } catch (e) {
        setError((e as Error).message);
      }
    }
    setReading(null);
  }

  async function publish() {
    setError(null);
    if (!course.trim() || !title.trim()) return setError("Add a course and a title.");
    if (!ownWork) return setError("Confirm this is your own work in your own words.");
    setPublishing(true);
    try {
      const res = await fetch("/api/handwritten/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course, title, ownWork, pages: pages.map(({ path, text }) => ({ path, text })) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      router.push(`/notes/${body.noteId}?uploaded=1`);
    } catch (e) {
      setError((e as Error).message);
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="card space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Course</span>
            <input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="CPSC 221" className="field" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Hash tables" className="field" />
          </label>
        </div>
        {pages.length < MAX_PAGES && (
          <label className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/40 p-6 text-center ${reading ? "pointer-events-none opacity-60" : "hover:bg-brand-50"}`}>
            {reading ? <Spinner /> : <Camera className="text-brand-600" aria-hidden />}
            <span className="font-semibold">{reading ?? (pages.length ? "Add more pages" : "Take or choose photos of your pages")}</span>
            <span className="text-xs text-black/50">Up to {MAX_PAGES} pages. Flat, bright, the whole page in frame.</span>
            <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
          </label>
        )}
      </div>

      {error && <Notice kind="error">{error}</Notice>}

      {pages.map((p, i) => {
        const warnings = [...(p.darkPhoto && !p.issues.includes("too_dark") ? ["too_dark"] : []), ...p.issues].map((w) => ISSUE_WORDS[w] ?? w);
        return (
          <div key={p.path} className="card space-y-3 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">Page {i + 1}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.legibility === "good" ? "bg-emerald-50 text-emerald-700" : p.legibility === "fair" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"}`}>
                {p.legibility === "good" ? "Easy to read" : p.legibility === "fair" ? "Partly readable" : "Hard to read"}
              </span>
            </div>
            {(warnings.length > 0 || p.legibility === "poor") && (
              <p className="flex items-start gap-1.5 rounded-xl bg-amber-50 p-2 text-sm text-amber-900">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
                {warnings.length ? `Check this page: ${warnings.join(", ")}.` : "Check this page carefully."} Fix the text below, or retake the photo.
              </p>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              {p.url && <img src={p.url} alt={`Your page ${i + 1}`} className="max-h-[480px] w-full rounded-xl border border-black/5 object-contain" />}
              <label className="block text-sm">
                <span className="mb-1 flex items-center gap-1 font-medium"><PenLine size={14} aria-hidden /> Transcription (edit anything that&apos;s wrong)</span>
                <textarea
                  value={p.text}
                  onChange={(e) => setPages((all) => all.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))}
                  rows={14}
                  className="field font-mono text-sm"
                />
              </label>
            </div>
          </div>
        );
      })}

      {pages.length > 0 && (
        <div className="card space-y-3 p-5">
          <label className="flex items-start gap-3 rounded-xl bg-brand-50/60 p-3 text-sm">
            <input type="checkbox" checked={ownWork} onChange={(e) => setOwnWork(e.target.checked)} className="mt-1 h-4 w-4" />
            <span>This is my own work in my own words. It doesn&apos;t copy slides, handouts, or lecture text word for word, and isn&apos;t AI output.</span>
          </label>
          <button onClick={publish} disabled={publishing || !!reading} className="btn-primary w-full">
            {publishing ? <><Spinner /> Splitting into sections, writing previews, checking for copies…</> : <><Check size={16} aria-hidden /> Publish study guide</>}
          </button>
          <p className="text-center text-xs text-black/45">Your photos stay private. The tutor only ever gets the text above.</p>
        </div>
      )}
    </div>
  );
}
