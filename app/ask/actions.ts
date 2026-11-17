"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { siteUrl } from "@/lib/site-url";
import { db } from "@/lib/supabase/admin";
import { askTutor, NeedsTopUpError } from "@/lib/tutor";

export async function askAction(formData: FormData) {
  const user = await requireUser();
  const question = String(formData.get("question") ?? "").trim().slice(0, 2000);
  if (!question) redirect("/ask");

  let runId: string;
  try {
    const result = await askTutor({
      db,
      baseUrl: await siteUrl(),
      user,
      question,
      // On the web, "ask human" waits for the student's answer on the results page.
      askHuman: async () => "pending",
    });
    runId = result.runId;
  } catch (err) {
    if (err instanceof NeedsTopUpError) redirect("/ask?error=topup");
    console.error("Ask failed:", err);
    redirect("/ask?error=failed");
  }
  redirect(`/ask/${runId}`);
}
