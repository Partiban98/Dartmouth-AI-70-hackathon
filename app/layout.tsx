import type { Metadata } from "next";
import { Source_Sans_3, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const ui = Source_Sans_3({ subsets: ["latin"], variable: "--font-ui", weight: ["400", "600", "700"] });
const paper = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-paper", weight: ["400", "500"] });

export const metadata: Metadata = { title: "Remain", description: "Grade a quiz question. AI suggests, you decide every mark." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${paper.variable}`} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-line bg-card">
          <div className="mx-auto max-w-[1280px] px-5 py-3 flex items-center gap-4">
            {/* A plain link, not a Next Link: on /grade it reloads, which returns the grader to the Start screen. */}
            <a href="/grade" className="flex items-baseline gap-2"><span className="text-xl font-bold tracking-tight">Remain</span><span className="text-sm text-fg-3">Grade</span></a>
            <p className="ml-auto text-sm text-fg-3 hidden sm:block">AI suggests. You decide every mark.</p>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-line text-xs text-fg-3">
          <div className="mx-auto max-w-[1280px] px-5 py-3 flex flex-wrap gap-4">
            <span>Remain, Dartmouth AI at 70</span>
            <Link href="/student" className="underline">Student companion (coming)</Link>
            <Link href="/staff" className="underline">Staff upskilling (coming)</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
