/**
 * The agent pays our own x402 endpoint over real HTTP, so the server needs
 * its public base URL. SITE_URL wins if set; otherwise use the request's host.
 */
import "server-only";
import { headers } from "next/headers";

export async function siteUrl(): Promise<string> {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
