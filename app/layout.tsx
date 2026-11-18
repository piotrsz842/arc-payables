import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "./login/actions";
import { BottomNav, TopNav } from "./ui/nav";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: "Notes by Students",
  description: "An AI tutor that learns your course from study guides students wrote, and pays them every time it uses one.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f7f5f1" };

// The frame around every page: top bar (+ tab bar on phones when signed in).
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en" className={jakarta.variable}>
      <body>
        <header className="sticky top-0 z-10 border-b border-black/5 bg-canvas/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-bold tracking-tight">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-600 text-sm text-white">N</span>
              <span>Notes by Students</span>
            </Link>
            {user ? (
              <>
                <TopNav />
                <form action={signOut} className="flex items-center gap-3 text-sm">
                  <span className="hidden text-black/60 sm:inline">{user.displayName}</span>
                  <button className="text-black/50 hover:text-ink">Sign out</button>
                </form>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <Link href="/login" className="hidden px-2 py-2 font-semibold text-black/60 hover:text-ink sm:inline">Sign in</Link>
                <Link href="/signup" className="btn-primary whitespace-nowrap px-3 py-2">Get started</Link>
              </div>
            )}
          </div>
        </header>
        <main className={`mx-auto max-w-5xl px-4 py-6 md:py-10 ${user ? "pb-28 md:pb-10" : ""}`}>{children}</main>
        {user && <BottomNav />}
      </body>
    </html>
  );
}
