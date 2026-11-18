"use client";

import { BookOpen, Home, MessageCircle, Upload, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/ask", label: "Ask", icon: MessageCircle },
  { href: "/study", label: "Study", icon: BookOpen },
  { href: "/notes/new", label: "Upload", icon: Upload },
  { href: "/earnings", label: "Earnings", icon: Wallet },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

/** Desktop: links in the top bar. */
export function TopNav() {
  const path = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {TABS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
            isActive(path, href) ? "bg-brand-50 text-brand-700" : "text-black/60 hover:bg-black/[0.04] hover:text-ink"
          }`}
        >
          <Icon size={16} aria-hidden /> {label}
        </Link>
      ))}
    </nav>
  );
}

/** Phone: a tab bar fixed to the bottom of the screen. */
export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-black/5 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive(path, href) ? "text-brand-700" : "text-black/50"}`}
          >
            <Icon size={20} aria-hidden /> {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
