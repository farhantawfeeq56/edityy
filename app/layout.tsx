import type { Metadata } from "next";
import "./globals.css";

// ponytail: system font stack instead of next/font/google. Geist is fetched from
// fonts.gstatic.com at build time, which fails on restricted networks. Add a bundled
// font when the brand needs one.
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