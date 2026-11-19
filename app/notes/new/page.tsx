import { Camera, Lightbulb } from "lucide-react";
import Link from "next/link";
import { Notice } from "@/app/ui/notice";
import { requireUser } from "@/lib/auth";
import { UploadForm } from "./upload-form";

const ERRORS: Record<string, string> = {
  missing: "Add a course, a title, and your study guide.",
  own: "Confirm this is your own work in your own words.",
  long: "That's too long. Upload one study guide at a time.",
  failed: "Something went wrong saving your study guide. Please try again.",
  duplicate: "Part of this study guide is almost identical to something already on the platform.",
};


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

      <UploadForm />

      <div className="card space-y-2 p-5 text-sm">
        <div className="flex items-center gap-2 font-semibold"><Lightbulb size={16} className="text-amber-600" aria-hidden /> What earns the most</div>
        <ul className="list-disc space-y-1 pl-5 text-black/60">
          <li>Worked examples with the course&apos;s own numbers and notation.</li>
          <li>Exam and quiz tips: what gets asked and how to answer it.</li>
          <li>Common mistakes and how to avoid them.</li>
          <li>Generic textbook facts earn little: the checker skips what any AI already knows.</li>
        </ul>
        <div className="border-t border-black/5 pt-3 text-black/60">
          <span className="font-semibold text-ink">How prices work.</span> We set them, the same way for everyone: base $0.002 × length (×1.0 to ×1.5, up to 300 words) × your rating (×0.5 to ×3.3). A 300-word section from a new author: Base $0.002 · length ×1.5 · rating ×1.0 = $0.0030 per section. Prices rise as students rate your guides helpful.
        </div>
      </div>
    </div>
  );
}
