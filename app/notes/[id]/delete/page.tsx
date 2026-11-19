import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/app/submit-button";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { deleteNoteAction } from "./actions";

export const dynamic = "force-dynamic";

/** Confirm step before an author deletes their own study guide. */
export default async function DeleteNotePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { data: note } = await db.from("notes").select("id, author_id, course, title, deleted_at").eq("id", id).single();
  if (!note || note.author_id !== user.id || note.deleted_at) notFound();

  return (
    <form action={deleteNoteAction} className="card mx-auto max-w-md space-y-4 p-6">
      <input type="hidden" name="noteId" value={note.id} />
      <h1 className="text-xl font-extrabold tracking-tight">Delete this study guide?</h1>
      <p className="text-sm">
        <span className="text-black/50">{note.course}</span> · <span className="font-medium">{note.title}</span>
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-black/60">
        <li>It stops being sold right away: the tutor and other AI agents can no longer find or buy it.</li>
        <li>What it already earned stays in your balance, and you can still cash it out.</li>
        <li>Sections an AI already bought can&apos;t be taken back, but they won&apos;t be sold again.</li>
      </ul>
      <div className="flex gap-2">
        <SubmitButton pendingText="Deleting…" className="btn bg-red-700 text-white hover:bg-red-800">Delete study guide</SubmitButton>
        <Link href={`/notes/${note.id}`} className="btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}
