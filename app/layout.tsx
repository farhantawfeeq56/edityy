import type { Metadata } from "next";
import "./globals.css";

// ponytail: system stack. DESIGN.md wants Nohemi + Plus Jakarta Sans, but
// next/font/google is fetched at build and fails on restricted networks — add
// bundled faces from app/fonts when the brand needs its own type.
export const metadata: Metadata = {
  title: "Edityy",
  description: "A visual editing layer for code-based websites.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-neutral-50 text-neutral-900">{children}</body>
    </html>
  );
}