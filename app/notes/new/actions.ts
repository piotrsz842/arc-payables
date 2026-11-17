"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { saveNote } from "@/lib/notes";
import { db } from "@/lib/supabase/admin";

const MAX_CHARS = 60_000; // about 10,000 words: plenty for a study guide

export async function uploadNote(formData: FormData) {
  const user = await requireUser();
  const course = String(formData.get("course") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  let body = String(formData.get("body") ?? "").trim();

  // A .txt / .md file can be uploaded instead of pasting.
  const file = formData.get("file");
  if (!body && file instanceof File && file.size > 0) body = (await file.text()).trim();

  if (!course || !title || !body) redirect("/notes/new?error=missing");
  if (body.length > MAX_CHARS) redirect("/notes/new?error=long");

  let count: number;
  try {
    count = await saveNote(db, { authorId: user.id, course, title, body });
  } catch (err) {
    console.error("Note upload failed:", err);
    redirect("/notes/new?error=failed");
  }
  redirect(`/?uploaded=${count}`);
}
