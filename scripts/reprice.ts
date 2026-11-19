/**
 * Put every existing section on the platform's pricing formula
 * (length × the author's rating). Safe to re-run.
 * Run: npm run reprice
 */
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "../lib/circle.js";
import { repriceAuthor } from "../lib/integrity.js";

const db = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), { auth: { persistSession: false } });
const { data: authors } = await db.from("snippets").select("author_id");
const ids = [...new Set((authors ?? []).map((a) => a.author_id as string))];
for (const id of ids) await repriceAuthor(db, id);
const { data: after } = await db.from("snippets").select("id, title, price_usd").order("price_usd", { ascending: false }).limit(50);
for (const s of after ?? []) console.log(`$${Number(s.price_usd).toFixed(4)}  ${s.title}`);
console.log(`Re-priced the sections of ${ids.length} authors.`);
