/**
 * Seed the demo authors from the notes the user wrote in demo-notes/.
 *
 * Each file (.md or .txt) is one note:
 *
 *   Author: Maya Chen
 *   Course: CPSC 221
 *   Title: Hash tables and hashing
 *   Price: 0.008          ← optional: a fixed price per section ("premium" note)
 *   ---
 *   # First topic
 *   ...
 *
 * Every author gets a real account + Circle wallet on Arc (like a signup);
 * password = DEMO_PASSWORD in .env. The note goes through the same code as
 * the upload page (split → Claude writes previews → priced → saved).
 * Safe to re-run: a note with the same author + title is skipped.
 *
 *   npm run seed-notes -- --dry     parse and show what would be created, no writes
 *   npm run seed-notes              create authors and notes
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "../lib/circle.js";
import { saveNote, splitNote } from "../lib/notes.js";
import { createUserWallet } from "../lib/wallets.js";

const DIR = process.argv.find((a) => a.startsWith("--dir="))?.slice(6) ?? "demo-notes";
const dry = process.argv.includes("--dry");

type ParsedNote = { file: string; author: string; course: string; title: string; price?: string; body: string };

function parse(file: string, text: string): ParsedNote {
  const [head, ...rest] = text.replace(/\r\n/g, "\n").split(/^---\s*$/m);
  if (rest.length === 0) throw new Error(`${file}: missing the --- line between the header and the notes`);
  const field = (name: string) => head.match(new RegExp(`^${name}:\\s*(.+)$`, "mi"))?.[1].trim();
  const author = field("Author"), course = field("Course"), title = field("Title");
  if (!author || !course || !title) throw new Error(`${file}: needs Author:, Course: and Title: lines`);
  return { file, author, course, title, price: field("Price"), body: rest.join("---").trim() };
}

const notes = readdirSync(DIR)
  .filter((f) => /\.(md|txt)$/i.test(f))
  .map((f) => parse(f, readFileSync(join(DIR, f), "utf8")));
if (notes.length === 0) throw new Error(`No .md or .txt files in ${DIR}/`);

for (const n of notes) {
  const sections = splitNote(n.body);
  console.log(`${n.file}: ${n.author} · ${n.course} · "${n.title}" · ${sections.length} sections${n.price ? ` · fixed price $${n.price}` : ""}`);
}
if (dry) process.exit(0);

const db = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false },
});
const password = requireEnv("DEMO_PASSWORD");
const { data: list, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;
const idByEmail = new Map(list.users.map((u) => [u.email, u.id]));

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function ensureAuthor(name: string): Promise<string> {
  const email = `${slug(name)}@example.com`;
  let id = idByEmail.get(email);
  if (!id) {
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    id = data.user.id;
    idByEmail.set(email, id);
  }
  const { data: existing } = await db.from("profiles").select("id").eq("id", id).maybeSingle();
  if (!existing) {
    const wallet = await createUserWallet();
    const { error } = await db
      .from("profiles")
      .insert({ id, email, display_name: name, wallet_id: wallet.id, wallet_address: wallet.address });
    if (error) throw error;
    console.log(`Created ${name} <${email}> with a wallet on Arc`);
  }
  return id;
}

for (const n of notes) {
  const authorId = await ensureAuthor(n.author);
  const { data: dupe } = await db.from("notes").select("id").eq("author_id", authorId).eq("title", n.title).maybeSingle();
  if (dupe) {
    console.log(`Skipped "${n.title}" (already there)`);
    continue;
  }
  const { sections } = await saveNote(db, { authorId, course: n.course, title: n.title, body: n.body, priceUsd: n.price });
  console.log(`Saved "${n.title}" by ${n.author}: ${sections} sections`);
}
console.log(`\nDone. Author logins: <name>@example.com, password = DEMO_PASSWORD in .env.`);
