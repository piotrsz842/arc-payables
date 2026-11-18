"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { deleteStudyGuide } from "@/lib/integrity";
import { db } from "@/lib/supabase/admin";

export async function deleteNoteAction(formData: FormData) {
  const user = await requireUser();
  const noteId = String(formData.get("noteId") ?? "");
  const ok = await deleteStudyGuide(db, user.id, noteId);
  redirect(ok ? "/?deleted=1" : "/");
}
