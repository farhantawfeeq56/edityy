import type { Metadata } from "next";
import Link from "next/link";
import { DocsNav } from "./nav-links";
import { nav } from "./nav";

export const metadata: Metadata = {
  title: "Docs — Edityy",
  description: "The Edityy docs: install, edit, and hand the edits to your agent.",
};

export default function DocsLayout({ children }: LayoutProps<"/docs">) {
  return (
    <div className="flex min-h-full flex-col bg-neutral-50">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[84rem] items-center gap-3 px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2 text-[0.875rem] font-semibold tracking-[-0.02em] text-neutral-900">
            <span aria-hidden="true" className="size-2 rounded-full bg-rose-500" />
            Edityy
          </Link>
          <span aria-hidden="true" className="text-neutral-300">
            /
          </span>
          <span className="text-[0.875rem] font-medium text-neutral-600">Docs</span>
          <Link
            href="/"
            className="ml-auto rounded-full px-3 py-1.5 text-[0.8125rem] font-medium text-neutral-600 tint hover:bg-blush hover:text-neutral-900"
          >
            Back to the site
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[84rem] flex-1 gap-10 px-5 sm:px-8">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 overflow-y-auto py-10 lg:block">
          <DocsNav nav={nav} />
        </aside>

        <main className="min-w-0 flex-1 py-8 lg:py-14">
          <div className="lg:hidden">
            <DocsNav nav={nav} variant="row" />
          </div>
          <div className="max-w-[46rem] pb-20">{children}</div>
        </main>
      </div>
    </div>
  );
}
