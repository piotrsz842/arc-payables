/**
 * Runs before every page request (Next.js 16 calls this file "proxy.ts";
 * older versions called it middleware.ts).
 *
 * Job 1: keep the login session fresh (Supabase login tokens expire, and only
 *        here can we write the refreshed cookie back to the browser).
 * Job 2: send anyone who isn't logged in to /login.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          // Put refreshed cookies on both the request (for this render)
          // and the response (so the browser stores them).
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          // Supabase sends no-cache headers so a refreshed login is never cached.
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Verifies the token (and refreshes it if needed). Must run on every request.
  const { data } = await supabase.auth.getClaims();
  const loggedIn = !!data?.claims?.sub;

  const publicPage = ["/login", "/signup"].some((p) => request.nextUrl.pathname.startsWith(p));
  if (!loggedIn && !publicPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}

// Skip static files, images, and the paid snippet API; run on everything else.
// /api/snippets is protected by PAYMENT (x402), not by login: the buyer is
// an AI agent with no login cookie, and a redirect would break the 402 flow.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/snippets|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
