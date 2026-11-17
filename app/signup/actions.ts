"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/supabase/admin";
import { createAuthClient } from "@/lib/supabase/server";
import { createUserWallet } from "@/lib/wallets";

/**
 * Sign up = (1) create the login, (2) create a Circle wallet on Arc,
 * (3) save the profile, (4) sign in. If any step fails, undo the login so
 * nobody is left half-registered.
 */
export async function signUp(formData: FormData) {
  const displayName = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!displayName || !email || password.length < 8) redirect("/signup?error=invalid");

  // 1. The login. email_confirm: true skips the confirmation email (hackathon demo).
  const { data: created, error: createError } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError || !created.user) redirect("/signup?error=taken");
  const userId = created.user.id;

  try {
    // 2 + 3. The hidden wallet, then the profile that points to it.
    const wallet = await createUserWallet();
    const { error } = await db.from("profiles").insert({
      id: userId,
      email,
      display_name: displayName,
      wallet_id: wallet.id,
      wallet_address: wallet.address,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("Signup failed after creating the login; rolling back:", err);
    await db.auth.admin.deleteUser(userId);
    redirect("/signup?error=wallet");
  }

  // 4. Sign in (sets the login cookie).
  const supabase = await createAuthClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) redirect("/login");
  redirect("/");
}
