import type { Metadata } from "next";
import localFont from "next/font/local";
// The motion tokens. The same file the editor chrome reads its timings from,
// so the site and the chrome run on one set of them.
import "edityy/motion.css";
import "./globals.css";

// Figtree, self-hosted from app/fonts so the build never reaches for
// fonts.gstatic.com. One variable file covers the ramp: 400 for body and
// meta copy, 500 for labels and actions, 600 for headings.
const figtree = localFont({
  src: "./fonts/Figtree-latin.woff2",
  weight: "300 900",
  variable: "--font-figtree",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Edityy",
  description: "A visual editing layer for code-based websites.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${figtree.variable}`}>
      <body className="flex min-h-full flex-col bg-neutral-50 text-neutral-900">{children}</body>
    </html>
  );
}