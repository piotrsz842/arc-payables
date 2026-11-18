import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { toMicro, toUsd } from "@/lib/ledger";
import { db } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const money = (micro: bigint) => `$${Number(toUsd(micro)).toFixed(3)}`;

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
    <div className="mx-auto max-w-3xl space-y-6">
      {uploaded && (
        <p className="rounded bg-green-50 p-3 text-sm text-green-800">
          Uploaded! Your study guide was split into {snippets?.length ?? 0} {snippets?.length === 1 ? "section" : "sections"}. The tutor can now find them.
        </p>
      )}
      <div>
        <p className="text-sm text-slate-500">{note.course}</p>
        <h1 className="text-2xl font-bold">{note.title}</h1>
        <p className="text-sm text-slate-600">Earned so far: {money(total)}</p>
        {note.deleted_at && (
          <p className="mt-2 rounded bg-slate-100 p-2 text-sm">You deleted this study guide. It is no longer sold; what it earned stays yours.</p>
        )}
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">What the tutor sees</h2>
        <p className="text-sm text-slate-600">
          The tutor only sees each section&apos;s title and one-line preview (free). It pays the price to read the full section, and that
          money goes to you.
        </p>
        <ul className="divide-y rounded border bg-white">
          {(snippets ?? []).map((s) => (
            <li key={s.id} className="flex justify-between gap-4 p-3 text-sm">
              <div>
                <p className="font-medium">
                  {s.title}
                  {s.flagged_at && !note.deleted_at && <span className="ml-2 rounded bg-amber-100 px-1 text-xs text-amber-900">off sale: reported, under review</span>}
                </p>
                <p className="text-slate-500">{s.summary}</p>
              </div>
              <div className="shrink-0 text-right">
                <p>${Number(s.price_usd).toFixed(3)} per use</p>
                <p className="text-slate-500">
                  {uses.get(s.id) ?? 0} {uses.get(s.id) === 1 ? "use" : "uses"} · {money(earned.get(s.id) ?? 0n)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex gap-4 text-sm">
        <Link href="/" className="underline">Back to your dashboard</Link>
        {!note.deleted_at && <Link href={`/notes/${note.id}/delete`} className="text-red-700 underline">Delete this study guide</Link>}
      </div>
    </div>
  );
}
