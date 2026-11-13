"use server"; // these functions run on the server when a form is submitted

import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });
  // Same message for "no such user" and "wrong password": don't tell an
  // attacker which emails exist.
  if (error) redirect("/login?error=1");
  redirect("/");
}

export async function signOut() {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  redirect("/login");
}
