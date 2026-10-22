import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { WorkspaceSync } from "@/components/WorkspaceSync";
import "./globals.css";

export const metadata: Metadata = {
  title: "FakeRadar – find fakes of your product",
  description: "Self-serve counterfeit and copycat listing monitor for small Indian D2C brands.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <WorkspaceSync />
        <header className="sticky top-0 z-30 border-b border-black/5 bg-white/70 backdrop-blur-xl backdrop-saturate-150">
          <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-6">
            <Link href="/" aria-label="FakeRadar home" className="transition hover:opacity-80">
              <Logo />
            </Link>
            <nav className="flex items-center gap-6 text-[13px] text-ink/80">
              <Link href="/takedowns" className="transition hover:text-ink">
                Takedowns
              </Link>
              <Link href="/new" className="rounded-full bg-ink px-3.5 py-1.5 font-medium text-white transition hover:bg-black">
                Add product
              </Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="border-t border-black/5">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-8 text-xs text-ink-faint">
            <span>FakeRadar · Amazon.in, Flipkart and Myntra</span>
            <span>Never files reports for you. You review and submit every takedown.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
