/**
 * Who is logged in, and what may they do?
 *
 * 1. Supabase verifies the login token's signature (getClaims). We never use
 *    getSession() on the server: it reads the cookie WITHOUT checking it.
 * 2. We look up the person's role in OUR profiles table.
 */
import "server-only";
import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/admin";

export type Role = "submitter" | "approver";
export type CurrentUser = { id: string; email: string; fullName: string; role: Role };

/** The logged-in user with their role, or null if nobody is logged in. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub; // "sub" = the user's ID inside the verified token
  if (error || !userId) return null;

  const { data: profile } = await db.from("profiles").select("*").eq("id", userId).single();
  if (!profile) return null; // logged in, but not one of our users: treat as nobody

  return { id: profile.id, email: profile.email, fullName: profile.full_name, role: profile.role };
}

/** Use at the top of any page/action that needs a login (optionally a role). */
export async function requireUser(role?: Role): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (role && user.role !== role) throw new Error(`Only a ${role} can do this.`);
  return user;
}
