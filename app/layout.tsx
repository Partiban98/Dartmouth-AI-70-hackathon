import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Remain: Show your work",
  description: "AI proposes with evidence, a person decides.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans min-h-screen">
        <header className="border-b border-line bg-card">
          <div className="mx-auto max-w-[1400px] px-6 py-3 flex items-center gap-6">
            <Link href="/grade" className="flex items-baseline gap-2">
              <span className="text-xl font-semibold tracking-tight">Remain</span>
              <span className="text-sm text-ink-3">Show your work</span>
            </Link>
            <nav className="flex gap-1 text-sm" aria-label="Personas">
              <Link href="/grade" className="px-3 py-1.5 rounded-md bg-ink text-white">Teacher and TA</Link>
              <Link href="/student" className="px-3 py-1.5 rounded-md text-ink-2 hover:bg-line">Student</Link>
              <Link href="/staff" className="px-3 py-1.5 rounded-md text-ink-2 hover:bg-line">Academic Staff</Link>
            </nav>
            <p className="ml-auto text-sm text-ink-3 hidden md:block">AI proposes with evidence. A person decides.</p>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
