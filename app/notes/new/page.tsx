import { requireUser } from "@/lib/auth";
import { uploadNote } from "./actions";

const ERRORS: Record<string, string> = {
  missing: "Please add a course, a title, and your notes.",
  long: "That's too long. Please upload one study guide at a time.",
  failed: "Something went wrong saving your notes. Please try again.",
};

export default async function NewNotePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireUser();
  const { error } = await searchParams;
  return (
    <form action={uploadNote} className="mx-auto max-w-2xl space-y-4 rounded-lg border bg-white p-6">
      <h1 className="text-xl font-bold">Upload a study guide</h1>
      <p className="text-sm text-slate-600">
        We split it into short sections. The AI tutor sees only a one-line preview of each, and you earn every time it uses one.
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
        Your notes (Markdown headings like <code># Quicksort</code> help us split them well)
        <textarea name="body" rows={14} className="mt-1 w-full rounded border px-3 py-2 font-mono text-sm" />
      </label>
      <label className="block text-sm">
        …or upload a .txt / .md file
        <input name="file" type="file" accept=".txt,.md,text/plain,text/markdown" className="mt-1 block text-sm" />
      </label>
      <button className="rounded bg-slate-900 px-4 py-2 font-medium text-white">Upload</button>
    </form>
  );
}
