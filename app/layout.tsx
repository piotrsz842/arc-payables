import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "./login/actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Notes by Students",
  description: "Students get paid when an AI tutor uses their notes",
};

// The frame around every page: header (with who's logged in) + page content.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <body>
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <span className="font-semibold">Notes by Students</span>
            {user && (
              <form action={signOut} className="flex items-center gap-3 text-sm">
                <span>
                  {user.fullName}{" "}
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs uppercase tracking-wide">{user.role}</span>
                </span>
                <button className="text-slate-500 underline">Sign out</button>
              </form>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
