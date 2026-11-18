import { SubmitButton } from "@/app/submit-button";
import { requireUser } from "@/lib/auth";
import { uploadNote } from "./actions";

const ERRORS: Record<string, string> = {
  missing: "Please add a course, a title, and your study guide.",
  own: "Please confirm this is your own work in your own words.",
  long: "That's too long. Please upload one study guide at a time.",
  failed: "Something went wrong saving your study guide. Please try again.",
};

export default async function NewNotePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireUser();
  const { error } = await searchParams;
  return (
    <form action={uploadNote} className="mx-auto max-w-2xl space-y-4 rounded-lg border bg-white p-6">
      <h1 className="text-xl font-bold">Upload a study guide</h1>
      <p className="text-sm text-slate-600">
        Share a study guide <strong>in your own words</strong>: explanations, worked examples, practice problems and exam tips for
        your course. We split it into short sections. The AI tutor sees only a one-line preview of each, and you earn every time it
        uses one.
      </p>
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{ERRORS[error]}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Course
          <input name="course" placeholder="CPSC 221" required className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <label className="block text-sm">
          Title
          <input name="title" placeholder="Sorting algorithms" required className="mt-1 w-full rounded border px-3 py-2" />
        </label>
      </div>
      <label className="block text-sm">
        Your study guide (Markdown headings like <code># Quicksort</code> help us split it well)
        <textarea name="body" rows={14} className="mt-1 w-full rounded border px-3 py-2 font-mono text-sm" />
      </label>
      <label className="block text-sm">
        …or upload a .txt / .md file
        <input name="file" type="file" accept=".txt,.md,text/plain,text/markdown" className="mt-1 block text-sm" />
      </label>
      <label className="flex items-start gap-2 rounded bg-slate-50 p-3 text-sm">
        <input name="own_work" type="checkbox" required className="mt-1" />
        <span>
          This is my own work in my own words. It doesn&apos;t copy slides, handouts, or lecture text word for word, and isn&apos;t
          AI output.
        </span>
      </label>
      <SubmitButton pendingText="Splitting your study guide and writing previews…">Upload</SubmitButton>
      <p className="text-xs text-slate-400">This takes about 10–30 seconds.</p>
    </form>
  );
}
