"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isReportReason, reportSnippet } from "@/lib/integrity";
import { db } from "@/lib/supabase/admin";

export async function reportAction(formData: FormData) {
  const user = await requireUser();
  const snippetId = String(formData.get("snippetId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const path = `/report/${encodeURIComponent(snippetId)}`;
  if (!snippetId || !isReportReason(reason)) redirect(`${path}?error=1`);
  await reportSnippet(db, { snippetId, reporterId: user.id, reason, details: String(formData.get("details") ?? "") });
  redirect(`${path}?sent=1`);
}
