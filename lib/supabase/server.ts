/**
 * Supabase client for LOGIN only (who is this person?).
 * Uses the publishable key + the user's login cookie. Because every table is
 * locked by RLS, this client can't read our data — that's on purpose.
 * Docs: https://supabase.com/docs/guides/auth/server-side/nextjs
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          // Pages can't change cookies, only actions/proxy can. If we're
          // in a page, ignore it: proxy.ts already refreshed the session.
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    },
  );
}
