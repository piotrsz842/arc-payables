import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { toMicro, toUsd } from "@/lib/ledger";
import { db } from "@/lib/supabase/admin";
import { Notice, usd } from "@/app/ui/notice";

export const dynamic = "force-dynamic";


/** One of the author's notes: how it was split, what the tutor sees, and what each part earned. */
export default async function NotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ uploaded?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { uploaded } = await searchParams;

  const { data: note } = await db.from("notes").select("id, author_id, course, title, created_at, deleted_at").eq("id", id).single();
  if (!note || note.author_id !== user.id) notFound(); // only the author sees this page

  const { data: snippets } = await db
    .from("snippets")
    .select("id, position, title, summary, price_usd, flagged_at")
    .eq("note_id", id)
    .order("position");
  const ids = (snippets ?? []).map((s) => s.id);
  const { data: sales } = ids.length
    ? await db.from("ledger_entries").select("snippet_id, amount_usd").eq("kind", "sale").in("snippet_id", ids)
    : { data: [] };
  const uses = new Map<string, number>();
  const earned = new Map<string, bigint>();
  for (const s of sales ?? []) {
    uses.set(s.snippet_id, (uses.get(s.snippet_id) ?? 0) + 1);
    earned.set(s.snippet_id, (earned.get(s.snippet_id) ?? 0n) + toMicro(s.amount_usd));
  }
  const total = [...earned.values()].reduce((a, b) => a + b, 0n);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {uploaded && (
        <Notice>
          Uploaded. Your study guide became {snippets?.length ?? 0} {snippets?.length === 1 ? "section" : "sections"}, and the tutor can find them now.
        </Notice>
      )}
      {note.deleted_at && <Notice kind="info">You deleted this study guide. It's no longer sold; what it earned stays yours.</Notice>}
      <div className="card flex items-end justify-between gap-4 p-5">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">{note.course}</div>
          <h1 className="truncate text-2xl font-extrabold tracking-tight">{note.title}</h1>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs text-black/50">Earned</div>
          <div className="text-2xl font-extrabold text-emerald-700">{usd(toUsd(total))}</div>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">What the tutor sees</h2>
        <p className="text-sm text-black/55">Only each section&apos;s title and one-line preview, for free. It pays to read the full section, and that goes to you.</p>
        <ul className="card divide-y divide-black/5">
          {(snippets ?? []).map((s) => (
            <li key={s.id} className="space-y-1 p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="font-semibold">{s.title}</span>
                <span className="shrink-0 font-semibold text-emerald-700">{usd(toUsd(earned.get(s.id) ?? 0n))}</span>
              </div>
              <p className="text-black/60">{s.summary}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-black/45">
                <span>{usd(s.price_usd)} per use</span>·<span>{uses.get(s.id) ?? 0} {uses.get(s.id) === 1 ? "use" : "uses"}</span>
                {s.flagged_at && !note.deleted_at && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">Off sale: reported, under review</span>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex items-center justify-between text-sm">
        <Link href="/" className="font-medium text-black/60 hover:text-ink">← Home</Link>
        {!note.deleted_at && <Link href={`/notes/${note.id}/delete`} className="font-medium text-red-700 hover:underline">Delete this study guide</Link>}
      </div>
    </div>
  );
}
