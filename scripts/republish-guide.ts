/**
 * Replace the text of a published guide that NOBODY has bought from yet
 * (stand-in for section editing, see README "What's next").
 *
 *   npm run republish-guide -- "<guide title>" <author email> <text file>
 *
 * Refuses if any section was ever proposed, bought or credited. Otherwise the
 * old guide is removed and the new text goes through saveNote, the same code
 * as an upload: sections, new previews, embeddings, near-duplicate check,
 * price. The Handwritten badge and the private photos carry over. If saving
 * fails (e.g. the duplicate check), the old guide is put back exactly.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "../lib/circle.js";
import { saveNote } from "../lib/notes.js";

const [title, email, file] = process.argv.slice(2);
if (!title || !email || !file) throw new Error('Usage: npm run republish-guide -- "<guide title>" <author email> <text file>');
const body = readFileSync(file, "utf8").replace(/\r\n/g, "\n").trim();

const db = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false },
});
const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
const authorId = list?.users.find((u) => u.email === email)?.id;
if (!authorId) throw new Error(`No account ${email}`);

const { data: note, error } = await db.from("notes").select("*").eq("author_id", authorId).eq("title", title).is("deleted_at", null).single();
if (error || !note) throw new Error(`No guide "${title}" by ${email}`);
const { data: oldSections } = await db.from("snippets").select("*").eq("note_id", note.id);
const ids = (oldSections ?? []).map((s) => s.id);

// Never replace what someone already paid for.
const { count: proposed } = await db.from("purchase_decisions").select("id", { count: "exact", head: true }).in("snippet_id", ids);
const { count: credited } = await db.from("ledger_entries").select("id", { count: "exact", head: true }).in("snippet_id", ids);
if ((proposed ?? 0) > 0 || (credited ?? 0) > 0) throw new Error("Someone already bought or was offered this guide: it can't be replaced in place.");

await db.from("notes").delete().eq("id", note.id); // sections go with it
try {
  const { noteId, sections } = await saveNote(db, {
    authorId, course: note.course, title: note.title, body, ownWorkConfirmed: note.own_work_confirmed,
    handwritten: note.handwritten, imagePaths: note.image_paths ?? undefined,
  });
  const { data: fresh } = await db.from("snippets").select("title, summary, price_usd, embedding").eq("note_id", noteId).order("position");
  console.log(`Republished "${note.title}" (${sections} section${sections === 1 ? "" : "s"}), handwritten=${note.handwritten}:`);
  for (const s of fresh ?? []) console.log(`  - ${s.title} (USD ${s.price_usd}, embedding ${s.embedding ? "yes" : "no"}): ${s.summary}`);
} catch (err) {
  // Put the old guide back exactly as it was.
  await db.from("notes").insert(note);
  await db.from("snippets").insert(oldSections ?? []);
  console.error("Not republished; the old guide is back.", (err as Error).message);
  process.exit(1);
}
