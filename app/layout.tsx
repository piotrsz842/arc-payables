import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arc Payables",
  description: "AI accounts-payable agent paying contractors in USDC/EURC on Arc",
};

// The frame around every page: header + page content.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b bg-white">
          <div className="mx-auto max-w-5xl px-4 py-3 font-semibold">Arc Payables</div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
