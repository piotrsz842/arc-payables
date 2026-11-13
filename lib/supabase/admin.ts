/**
 * Supabase client for DATA (server only).
 * Uses the SECRET key, which bypasses Row Level Security. So: only call it
 * AFTER our code has checked who the user is and what their role allows.
 */
import "server-only"; // build fails if this file is ever imported into browser code
import { createClient } from "@supabase/supabase-js";

export const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
