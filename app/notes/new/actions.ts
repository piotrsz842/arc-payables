"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { DuplicateContentError, saveNote } from "@/lib/notes";
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
  // Required on the form, checked again here: the author confirms it is their own work.
  if (formData.get("own_work") !== "on") redirect("/notes/new?error=own");
  if (body.length > MAX_CHARS) redirect("/notes/new?error=long");

  let noteId: string;
  try {
    ({ noteId } = await saveNote(db, { authorId: user.id, course, title, body, ownWorkConfirmed: true }));
  } catch (err) {
    if (err instanceof DuplicateContentError) redirect(`/notes/new?error=duplicate&detail=${encodeURIComponent(err.message)}`);
    console.error("Note upload failed:", err);
    redirect("/notes/new?error=failed");
  }
  redirect(`/notes/${noteId}?uploaded=1`); // show the author what the tutor will see
}
