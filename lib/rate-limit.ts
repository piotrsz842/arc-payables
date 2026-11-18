/**
 * Signup protection. Every signup creates a real Circle wallet, so we limit
 * how fast accounts can be made, in two simple layers:
 *
 *   1. Site-wide (reliable): at most SITE_MAX new accounts per window,
 *      counted from the profiles table, so it holds across all Vercel servers.
 *   2. Per visitor (best effort): at most IP_MAX signups per IP per window,
 *      remembered in this server's memory. Vercel runs several servers, so
 *      this can be bypassed; layer 1 is the real cap.
 *
 * Production would use a shared store (e.g. Redis) plus a CAPTCHA.
 */
import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/supabase/admin";

const WINDOW_MINUTES = 60;
const SITE_MAX = 30;
const IP_MAX = 3;

const recentByIp = new Map<string, number[]>();

export async function signupAllowed(): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000);

  // 1. Site-wide.
  const { count, error } = await db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since.toISOString());
  if (error) throw new Error(`Could not check the signup limit: ${error.message}`);
  if ((count ?? 0) >= SITE_MAX) return false;

  // 2. Per IP.
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  const times = (recentByIp.get(ip) ?? []).filter((t) => t > since.getTime());
  if (times.length >= IP_MAX) return false;
  times.push(Date.now());
  recentByIp.set(ip, times);
  return true;
}
