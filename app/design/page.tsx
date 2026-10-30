import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DesignPreview } from "./preview";

export const metadata: Metadata = {
  title: "Design system preview — Edityy",
  robots: { index: false, follow: false },
};

export default function DesignPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <DesignPreview />;
}
