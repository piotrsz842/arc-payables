/**
 * Give one of your study guides to a demo author, so the demo shows several
 * students' work without re-uploading anything (the near-duplicate check
 * would reject a re-upload as a copy).
 *
 *   npm run move-guide -- "<guide title>" "<Author Name>" [--from=<your email>]
 *
 * The author gets a real account + Circle wallet on Arc, exactly like
 * seed-notes (login <name-slug>@example.com, password DEMO_PASSWORD in .env).
 * The guide and its sections change owner; sales already made stay with
 * whoever earned them. Afterwards run `npm run reprice` (prices follow the
 * author's ratings).
 */
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "../lib/circle.js";
import { createUserWallet } from "../lib/wallets.js";

const [title, authorName] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const from = process.argv.find((a) => a.startsWith("--from="))?.slice(7);
if (!title || !authorName) throw new Error('Usage: npm run move-guide -- "<guide title>" "<Author Name>" [--from=email]');

const db = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false },
});
const { data: list, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;

// The guide: by title (and owner, if given). Must be exactly one.
let query = db.from("notes").select("id, author_id, title").eq("title", title).is("deleted_at", null);
if (from) {
  const owner = list.users.find((u) => u.email === from);
  if (!owner) throw new Error(`No account ${from}`);
  query = query.eq("author_id", owner.id);
}
const { data: matches, error } = await query;
if (error) throw error;
if (matches?.length !== 1) throw new Error(`Expected one guide titled "${title}", found ${matches?.length ?? 0}`);
const note = matches[0];

// The author: same account setup as seed-notes.
const slug = authorName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const email = `${slug}@example.com`;
let authorId = list.users.find((u) => u.email === email)?.id;
if (!authorId) {
  const { data, error: e } = await db.auth.admin.createUser({ email, password: requireEnv("DEMO_PASSWORD"), email_confirm: true });
  if (e) throw e;
  authorId = data.user.id;
}
const { data: profile } = await db.from("profiles").select("id").eq("id", authorId).maybeSingle();
if (!profile) {
  const wallet = await createUserWallet();
  const { error: e } = await db.from("profiles").insert({ id: authorId, email, display_name: authorName, wallet_id: wallet.id, wallet_address: wallet.address });
  if (e) throw e;
  console.log(`Created ${authorName} <${email}> with a wallet on Arc`);
}

const { error: e1 } = await db.from("notes").update({ author_id: authorId }).eq("id", note.id);
if (e1) throw e1;
const { count, error: e2 } = await db.from("snippets").update({ author_id: authorId }, { count: "exact" }).eq("note_id", note.id);
if (e2) throw e2;
console.log(`Moved "${note.title}" (${count} sections) to ${authorName}.`);
