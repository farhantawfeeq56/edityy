"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The sidebar. It marks the page you are on, so you know where you are in a
// long page set. The list is the same one the sidebar uses.
export function DocsNav({
  nav,
  variant = "sidebar",
}: {
  nav: { title: string; pages: { href: string; title: string }[] }[];
  variant?: "sidebar" | "row";
}) {
  const pathname = usePathname();

  if (variant === "row") {
    return (
      <nav aria-label="Docs" className="-mx-5 overflow-x-auto px-5 pb-3 sm:mx-0 sm:px-0">
        <ul className="flex gap-1.5 whitespace-nowrap">
          {nav.flatMap((group) => group.pages).map((page) => {
            const active = pathname === page.href;
            return (
              <li key={page.href}>
                <Link
                  href={page.href}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-lg border px-3 py-1.5 text-[0.8125rem] tint ${
                    active
                      ? "border-neutral-200 bg-blush font-medium text-neutral-900"
                      : "border-neutral-200 text-neutral-600 hover:bg-blush/60 hover:text-neutral-900"
                  }`}
                >
                  {page.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label="Docs" className="pb-10">
      {nav.map((group) => (
        <div key={group.title} className="mb-7">
          <p className="overline px-2">
            {group.title}
          </p>
          <ul className="mt-2.5 space-y-0.5">
            {group.pages.map((page) => {
              const active = pathname === page.href;
              return (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-lg px-2 py-1.5 text-[0.875rem] tint ${
                      active
                        ? "bg-blush font-medium text-neutral-900"
                        : "text-neutral-600 hover:bg-blush/60 hover:text-neutral-900"
                    }`}
                  >
                    {page.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
