/**
 * Who is logged in?
 *
 * 1. Supabase verifies the login token's signature (getClaims). We never use
 *    getSession() on the server: it reads the cookie WITHOUT checking it.
 * 2. We look the person up in OUR profiles table (name, hidden wallet, free questions).
 *
 * There are no roles: every user can both upload notes and ask the tutor.
 */
import "server-only";
import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/admin";

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  walletId: string;
  walletAddress: string;
  freeQuestionsLeft: number;
  approvalThresholdUsd: string; // "ask me before any single purchase over $X"
};

/** The logged-in user, or null if nobody is logged in. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub; // "sub" = the user's ID inside the verified token
  if (error || !userId) return null;

  const { data: p } = await db.from("profiles").select("*").eq("id", userId).single();
  if (!p) return null; // logged in, but no profile: treat as nobody

  return {
    id: p.id,
    email: p.email,
    displayName: p.display_name,
    walletId: p.wallet_id,
    walletAddress: p.wallet_address,
    freeQuestionsLeft: p.free_questions_left,
    approvalThresholdUsd: String(p.approval_threshold_usd ?? "0.005"), // default until migration 008 runs
  };
}

/** Use at the top of any page/action that needs a login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
