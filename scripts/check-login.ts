/**
 * Test the login path without anyone having to see the demo password:
 *   1. sign in as each demo user (publishable key, like the browser does)
 *   2. verify the token with getClaims() and look up the role (like lib/auth.ts)
 *   3. prove a LOGGED-IN user still can't read tables with the browser key
 *
 * Run: npm run check-login
 */
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "../lib/circle.js";

const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const opts = { auth: { persistSession: false } };
const server = createClient(url, requireEnv("SUPABASE_SECRET_KEY"), opts);

for (const email of ["alice@example.com", "bob@example.com"]) {
  const browser = createClient(url, requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), opts);
  const { error } = await browser.auth.signInWithPassword({ email, password: requireEnv("DEMO_PASSWORD") });
  if (error) {
    console.log(`${email}: sign-in FAILED (${error.message})`);
    continue;
  }
  const { data } = await browser.auth.getClaims();
  const userId = data?.claims?.sub;
  const { data: profile } = await server.from("profiles").select("full_name, role").eq("id", userId!).single();
  const { data: leaked } = await browser.from("invoices").select("*").limit(1);
  const { data: leakedProfiles } = await browser.from("profiles").select("*").limit(1);
  console.log(
    `${email}: signed in ✓ | role: ${profile?.role} (${profile?.full_name}) | ` +
      `tables readable from browser while logged in: invoices ${leaked?.length ?? 0}, profiles ${leakedProfiles?.length ?? 0}`,
  );
  await browser.auth.signOut();
}

// And a wrong password must fail.
const browser = createClient(url, requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), opts);
const bad = await browser.auth.signInWithPassword({ email: "alice@example.com", password: "wrong-password" });
console.log(`wrong password rejected: ${!!bad.error}`);
