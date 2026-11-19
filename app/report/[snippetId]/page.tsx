import Link from "next/link";
import { SubmitButton } from "@/app/submit-button";
import { requireUser } from "@/lib/auth";
import { REPORT_REASONS } from "@/lib/integrity";
import { db } from "@/lib/supabase/admin";
import { reportAction } from "./actions";

export const dynamic = "force-dynamic";

/** Report a study-guide section. One report takes it off sale until a person reviews it. */
export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ snippetId: string }>;
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  await requireUser();
  const { snippetId } = await params;
  const { sent, error } = await searchParams;
  // Title + course only (public preview info), even if it's already flagged.
  const { data: s } = await db.from("snippets").select("id, title, course").eq("id", snippetId).maybeSingle();

  return (
    <div className="card mx-auto max-w-lg space-y-4 p-6">
      <h1 className="text-xl font-extrabold tracking-tight">Report a study guide section</h1>
      {!s ? (
        <p className="text-sm text-black/60">We couldn&apos;t find that section.</p>
      ) : sent ? (
        <>
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            Thanks. “{s.title}” is off sale until someone reviews your report.
          </p>
          <Link href="/" className="inline-block text-sm underline">Back to your dashboard</Link>
        </>
      ) : (
        <form action={reportAction} className="space-y-3">
          <input type="hidden" name="snippetId" value={s.id} />
          <p className="text-sm">
            <span className="text-black/50">{s.course}</span> · <span className="font-medium">{s.title}</span>
          </p>
          {error && <p className="rounded-xl border border-red-200 bg-red-50 p-2 text-sm text-red-900">Pick a reason.</p>}
          <fieldset className="space-y-2 text-sm">
            <legend className="mb-1 text-black/60">What&apos;s wrong?</legend>
            {Object.entries(REPORT_REASONS).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input type="radio" name="reason" value={key} required /> {label}
              </label>
            ))}
          </fieldset>
          <label className="block text-sm">
            Details (optional)
            <textarea name="details" rows={3} maxLength={1000} className="field mt-1" />
          </label>
          <p className="text-xs text-black/50">The section stops being sold right away, until a person reviews the report.</p>
          <SubmitButton pendingText="Sending…" className="btn-primary">Send report</SubmitButton>
        </form>
      )}
    </div>
  );
}
