import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import "./globals.css";

export const metadata: Metadata = {
  title: "FakeRadar – find fakes of your product",
  description: "Self-serve counterfeit and copycat listing monitor for small Indian D2C brands.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <Link href="/" aria-label="FakeRadar home">
              <Logo />
            </Link>
            <Link href="/new" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
              + Add product
            </Link>
          </div>
        </header>
        <main>{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-slate-400">
          FakeRadar prototype · Never files reports for you — you review and submit every takedown yourself.
        </footer>
      </body>
    </html>
  );
}
