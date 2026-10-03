import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Plus Jakarta Sans, self-hosted from app/fonts so the build never reaches for
// fonts.gstatic.com. Only the three weights the ramp uses are shipped: 400 for
// body and meta copy, 500 for labels and actions, 600 for headings.
const jakarta = localFont({
  src: [
    { path: "./fonts/PlusJakartaSans-400-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/PlusJakartaSans-500-latin.woff2", weight: "500", style: "normal" },
    { path: "./fonts/PlusJakartaSans-600-latin.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-jakarta",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Edityy",
  description: "A visual editing layer for code-based websites.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${jakarta.variable}`}>
      <body className="flex min-h-full flex-col bg-neutral-50 text-neutral-900">{children}</body>
    </html>
  );
}