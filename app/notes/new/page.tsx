import { Camera, Lightbulb } from "lucide-react";
import Link from "next/link";
import { SubmitButton } from "@/app/submit-button";
import { Notice } from "@/app/ui/notice";
import { requireUser } from "@/lib/auth";
import { uploadNote } from "./actions";

const ERRORS: Record<string, string> = {
  missing: "Add a course, a title, and your study guide.",
  own: "Confirm this is your own work in your own words.",
  long: "That's too long. Upload one study guide at a time.",
  failed: "Something went wrong saving your study guide. Please try again.",
  duplicate: "Part of this study guide is almost identical to something already on the platform.",
};

const TEMPLATE = `# First topic
Explain it the way you'd explain it to a classmate.

Worked example: …

Exam tip: …

# Second topic
…`;

export default async function NewNotePage({ searchParams }: { searchParams: Promise<{ error?: string; detail?: string }> }) {
  await requireUser();
  const { error, detail } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Upload a study guide</h1>
        <p className="text-black/55">
          In <strong className="font-semibold text-ink">your own words</strong>. The tutor sees a one-line preview of each section and pays you every time it uses one.
        </p>
      </div>
      <Link href="/notes/handwritten" className="card flex items-center gap-3 p-4 text-sm hover:border-brand-200">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Camera size={18} aria-hidden /></span>
        <span><span className="font-semibold">Handwritten notes?</span> <span className="text-black/55">Snap photos of your pages instead.</span></span>
      </Link>
      {error && <Notice kind="error">{error === "duplicate" && detail ? detail : ERRORS[error]}</Notice>}

      <form action={uploadNote} className="card space-y-4 p-5">
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
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Your study guide</span>
          <textarea name="body" rows={14} defaultValue="" placeholder={TEMPLATE} className="field font-mono text-sm" />
          <span className="mt-1 block text-xs text-black/45">Start each topic with a # heading. Each one becomes a section the tutor can use.</span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">…or upload a .txt / .md file</span>
          <input name="file" type="file" accept=".txt,.md,text/plain,text/markdown" className="block text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-semibold file:text-brand-700" />
        </label>
        <label className="flex items-start gap-3 rounded-xl bg-brand-50/60 p-3 text-sm">
          <input name="own_work" type="checkbox" required className="mt-1 h-4 w-4 accent-[var(--color-brand-600)]" />
          <span>This is my own work in my own words. It doesn&apos;t copy slides, handouts, or lecture text word for word, and isn&apos;t AI output.</span>
        </label>
        <SubmitButton pendingText="Splitting into sections, writing previews, checking for copies…" className="btn-primary w-full">Upload study guide</SubmitButton>
        <p className="text-center text-xs text-black/45">Takes about 10–30 seconds.</p>
      </form>

      <div className="card space-y-2 p-5 text-sm">
        <div className="flex items-center gap-2 font-semibold"><Lightbulb size={16} className="text-amber-600" aria-hidden /> What earns the most</div>
        <ul className="list-disc space-y-1 pl-5 text-black/60">
          <li>Worked examples with the course&apos;s own numbers and notation.</li>
          <li>Exam and quiz tips: what gets asked and how to answer it.</li>
          <li>Common mistakes and how to avoid them.</li>
          <li>Generic textbook facts earn little: the checker skips what any AI already knows.</li>
        </ul>
      </div>
    </div>
  );
}
