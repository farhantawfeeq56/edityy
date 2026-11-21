import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { CopyButton } from "./copy";
import logo from "./logo.png";

const INSTALL = "npx edityy init";
const NPM = "https://www.npmjs.com/package/edityy";
const GITHUB = "https://github.com/farhantawfeeq56/edityy";

const loop = [
  {
    n: "01",
    title: "Run",
    body: "Add one line to your dev server with npx edityy init. A launcher appears on the page you already run. Dev only — it never ships to production.",
    artifact: (
      <>
        <span aria-hidden="true" className="text-neutral-400">$</span> {INSTALL}
      </>
    ),
    meta: "Vite · Next.js · Connect — doctor checks it again",
  },
  {
    n: "02",
    title: "Point",
    body: "The launcher sits in a corner until you need it. Click it, hover to outline anything, click to select. Shift-click adds to the set; arrows walk the tree.",
    artifact: (
      <>
        <span aria-hidden="true" className="inline-block size-2 rounded-full bg-brand" /> launcher · 8 places · Alt+E
      </>
    ),
    meta: "Edit text · Move · Comment · Variations · Delete",
  },
  {
    n: "03",
    title: "Change",
    body: "The dock styles type, colour, spacing, fill, border, shadow and filters. Type words in place, arrange elements, try variants, or write one note for the whole set.",
    artifact: <>Type · Colour · Space · Fill · Border · Shadow</>,
    meta: "1–0 switches variants · edityy:: asks from chat · ⌘Z undoes",
  },
  {
    n: "04",
    title: "Hand off",
    body: "Edityy never writes your source. It writes down what changed — selector, source line, each value — and your agent makes the change in the file.",
    artifact: <>get_work → mark_applied</>,
    meta: "Copy as prompt · save to project · read over MCP",
  },
];

const capabilities = [
  {
    wide: true,
    icon: "variants",
    title: "Variations, then one keeper",
    body: "Ask for N looks on one element. Keys 1–0 switch the pick live on the page; Keep saves it as an ordinary edit. The shared note stays single-element — comments are for meaning, variants are for looks.",
  },
  {
    wide: true,
    icon: "chat",
    title: "Ask from agent chat",
    body: "Type edityy:: plus the change you want. The agent writes it into your source directly — no canvas paint, nothing to keep or discard. Sent waits for the agent, Select waits for your pick, Ready waits for the code.",
  },
  {
    wide: false,
    icon: "grid",
    title: "Arrange",
    body: "Add, move and delete elements. Shift-click siblings, Shift+A stacks them in a column.",
  },
  {
    wide: false,
    icon: "type",
    title: "Fonts",
    body: "Pick from the fonts already on the page, or browse Google Fonts. A face loads only when you preview or pick it.",
  },
  {
    wide: false,
    icon: "undo",
    title: "Undo with trust",
    body: "Undo and redo every change. The edits list reviews, selects, or reverts each one. Leaving the mode restores the page exactly.",
  },
  {
    wide: false,
    icon: "comment",
    title: "Comment on one — or several",
    body: "One note travels with the edit. Shift-click builds a set, or draw a box around it; the save lands on every selected element as one combined change.",
  },
];

const glyphs: Record<string, string> = {
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  undo: "M8 5L4 9l4 4M4 9h10a5 5 0 010 10H8",
  type: "M5 6h14M12 6v13M9 19h6",
  comment: "M4 5h16v10H9l-5 4z",
  variants: "M4 7h9M4 12h6M4 17h9M15 14l5 5m0-5l-5 5",
  chat: "M4 5h16v11H9l-5 4zM8 9h8M8 12h5",
};

function Icon({ name, className = "size-4" }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={glyphs[name]} />
    </svg>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-neutral-500">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
      {children}
    </p>
  );
}

function Install() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-100 py-1 pl-4 pr-1 shadow-layer">
        <span aria-hidden="true" className="font-mono text-[0.8125rem] text-neutral-600">
          $
        </span>
        <span className="mx-1 font-mono text-[0.8125rem] text-neutral-900">{INSTALL}</span>
        <CopyButton value={INSTALL} />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-3 z-40 px-4 sm:top-5">
        <nav
          aria-label="Main"
          className="site-header mx-auto flex w-full max-w-[68rem] items-center gap-2 rounded-[17px] border border-neutral-200 py-2 pl-4 pr-2 shadow-layer backdrop-blur-md"
        >
          <Link href="/" className="flex items-center gap-2 text-[0.875rem] font-semibold tracking-[-0.02em]">
            <Image src={logo} alt="" aria-hidden="true" className="size-5" />
            Edityy
          </Link>
          <div className="ml-auto hidden items-center gap-1 sm:flex">
            <a
              className="rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium text-neutral-600 tint hover:bg-blush hover:text-neutral-900"
              href="#loop"
            >
              The loop
            </a>
            <a
              className="rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium text-neutral-600 tint hover:bg-blush hover:text-neutral-900"
              href="#capabilities"
            >
              Capabilities
            </a>
            <Link
              className="rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium text-neutral-600 tint hover:bg-blush hover:text-neutral-900"
              href="/docs"
            >
              Docs
            </Link>
            <a
              className="rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium text-neutral-600 tint hover:bg-blush hover:text-neutral-900"
              href={GITHUB}
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </div>
          <a
            href="#install"
            className="ml-auto rounded-lg bg-neutral-900 px-3.5 py-1.5 text-[0.8125rem] font-medium text-neutral-50 tint hover:bg-neutral-700 sm:ml-2"
          >
            Install
          </a>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[68rem] flex-1 px-5 pb-24 sm:px-8">
        <section className="max-w-[46rem] pt-16 sm:pt-24">
          <Eyebrow>Edityy · a visual editing layer · MIT</Eyebrow>
          <h1 className="mt-5 text-balance font-display text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-[4.25rem] sm:leading-[1.0]">
            The page is the editor. <span className="text-brand-ink">The code stays the code.</span>
          </h1>
          <p className="mt-6 max-w-[34rem] text-pretty text-[1rem] leading-relaxed text-neutral-600">
            Edityy sits on the site you already run. Point at anything, restyle it, reword it,
            rearrange it, or leave one note for the whole set — then hand every change to your
            agent as a prompt, a project file, or an MCP read.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#install"
              className="rounded-lg bg-neutral-900 px-6 py-3 text-[0.9375rem] font-medium text-neutral-50 tint hover:bg-neutral-700"
            >
              Install Edityy — it&apos;s free
            </a>
            <Link
              href="/docs"
              className="rounded-lg border border-neutral-200 bg-white px-6 py-3 text-[0.9375rem] font-medium text-neutral-900 tint hover:border-neutral-300"
            >
              View docs →
            </Link>
          </div>
          <p className="mt-6 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-neutral-500">
            Zero dependencies · dev only · open source
          </p>
        </section>

        <section id="loop" className="scroll-mt-28 pt-20 sm:pt-24">
          <Eyebrow>The loop</Eyebrow>
          <h2 className="mt-4 max-w-[32rem] text-balance font-display text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[2.5rem]">
            Four stages, <span className="text-brand-ink">then back to code</span>
          </h2>
          <ol className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 md:grid-cols-4">
            {loop.map((stage) => (
              <li key={stage.n} className="flex flex-col bg-neutral-50 p-6">
                <span className="font-mono text-[0.75rem] text-brand-ink">{stage.n}</span>
                <h3 className="mt-3 text-[1rem] font-semibold tracking-[-0.02em]">{stage.title}</h3>
                <p className="mt-2 flex-1 text-[0.875rem] leading-relaxed text-neutral-600">{stage.body}</p>
                <p className="mt-4 rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2 font-mono text-[0.6875rem] leading-relaxed text-neutral-700">
                  {stage.artifact}
                </p>
                <p className="mt-2 font-mono text-[0.625rem] uppercase tracking-[0.1em] text-neutral-500">
                  {stage.meta}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section id="capabilities" className="mt-20 scroll-mt-28 border-t border-neutral-200 pt-16 sm:mt-24 sm:pt-20">
          <Eyebrow>Capabilities</Eyebrow>
          <h2 className="mt-4 max-w-[34rem] text-balance font-display text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[2.5rem]">
            Everything the canvas holds.
          </h2>
          <ul className="mt-10 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.map((cap) => (
              <li
                key={cap.title}
                className={`group rounded-2xl border border-neutral-200 bg-neutral-100 p-6 lift hover:border-neutral-300 ${
                  cap.wide ? "sm:col-span-2" : ""
                }`}
              >
                <span className="flex size-9 items-center justify-center rounded-lg border border-neutral-200 bg-blush text-neutral-900 group-hover:border-neutral-300 group-hover:bg-rose tint">
                  <Icon name={cap.icon} />
                </span>
                <h3 className="mt-4 text-[0.9375rem] font-semibold tracking-[-0.02em]">{cap.title}</h3>
                <p className="mt-2 text-[0.875rem] leading-relaxed text-neutral-600">{cap.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="install" className="mt-20 scroll-mt-28 border-t border-neutral-200 pt-16 text-center sm:mt-24 sm:pt-20">
          <h2 className="mx-auto max-w-[30rem] text-balance font-display text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[2.5rem]">
            Ready when your dev server is.
          </h2>
          <p className="mx-auto mt-4 max-w-[30rem] text-[0.9375rem] leading-relaxed text-neutral-600">
            Install the package, add one line, and reload the page. The launcher settles in a
            corner — Alt+E opens it from the keyboard, Escape walks you back out.
          </p>
          <div className="mt-9">
            <Install />
          </div>
          <p className="mx-auto mt-6 max-w-[30rem] text-[0.8125rem] leading-relaxed text-neutral-600">
            <Link className="font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 tint hover:decoration-neutral-900" href="/docs">
              Setup guide and full details
            </Link>
            {" · "}
            <a className="underline decoration-neutral-300 underline-offset-4 tint hover:text-neutral-900 hover:decoration-neutral-900" href={GITHUB} target="_blank" rel="noreferrer">
              view the source
            </a>
          </p>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-[68rem] px-5 pb-10 sm:px-8">
        <div className="flex flex-col items-center gap-4 border-t border-neutral-200 pt-6 text-[0.8125rem] text-neutral-600 sm:flex-row sm:justify-between">
          <span className="flex items-center gap-2 font-medium text-neutral-900">
            <Image src={logo} alt="" aria-hidden="true" className="size-5" />
            Edityy
          </span>
          <div className="flex items-center gap-5">
            <Link className="tint hover:text-neutral-900" href="/docs">
              Docs
            </Link>
            <a className="tint hover:text-neutral-900" href={GITHUB} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a className="tint hover:text-neutral-900" href={NPM} target="_blank" rel="noreferrer">
              npm
            </a>
            <a className="tint hover:text-neutral-900" href={`${GITHUB}/releases`} target="_blank" rel="noreferrer">
              Changelog
            </a>
            <span>MIT</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
