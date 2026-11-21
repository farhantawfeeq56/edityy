import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { CopyButton } from "./copy";
import { CommentDemo } from "./comment-demo";
import logo from "./logo.png";

const INSTALL = "npx edityy init";
const NPM = "https://www.npmjs.com/package/edityy";
const GITHUB = "https://github.com/farhantawfeeq56/edityy";

const steps = [
  {
    title: "Select on the live page",
    body: "Click the launcher, point at anything — one card or a whole row. Hover outlines it, a click keeps it.",
  },
  {
    title: "Say what should change",
    body: "Style it in the dock, or write one note for the set. The note travels with every selected element.",
  },
  {
    title: "Your agent writes the code",
    body: "Copy the edits, save them to the project, or let the agent read them over MCP. Source stays truth.",
  },
];

const features = [
  {
    icon: "comment",
    title: "One note, several elements",
    body: "A change that spans three cards gets one shared note, not three. The agent reads them as one change.",
  },
  {
    icon: "cursor",
    title: "Edit where it stands",
    body: "Type new words in place. Change type, colour, spacing, fill, border, shadow and filters.",
  },
  {
    icon: "grid",
    title: "Arrange the set",
    body: "Add, move and delete elements. Shift-click siblings, press Shift+A for a column.",
  },
  {
    icon: "variants",
    title: "Try N variants, keep one",
    body: "Ask for variants on one element. Keys 1–0 switch the pick live, Keep saves it as an edit.",
  },
  {
    icon: "undo",
    title: "Undo with trust",
    body: "Undo and redo style changes. Review each edit, select its element, or revert it any time.",
  },
  {
    icon: "agent",
    title: "Work with your agent",
    body: "Saved edits travel as Markdown, as .edityy/changes.json, or over MCP to Claude Code and Cursor.",
  },
];

const handoffs = [
  {
    label: "Copy the edits",
    body: "Paste them into your agent as a prompt. Each edit names its selector, its source line and each value.",
  },
  {
    label: "Save to the project",
    body: "The edits land in .edityy/changes.json, in the folder your project already has.",
  },
  {
    label: "Read over MCP",
    body: "Run npx edityy mcp and the agent reads the same file, with no copy and no paste.",
  },
];

const glyphs: Record<string, string> = {
  cursor: "M5 4l6.5 15 2.2-6.3L20 10.5z",
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  undo: "M8 5L4 9l4 4M4 9h10a5 5 0 010 10H8",
  comment: "M4 5h16v10H9l-5 4z",
  variants: "M4 7h9M4 12h6M4 17h9M15 14l5 5m0-5l-5 5",
  agent: "M12 4l1.9 4.3L18 10l-4.1 1.7L12 16l-1.9-4.3L6 10l4.1-1.7z",
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

function Install({ note }: { note?: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-100 py-1 pl-4 pr-1 shadow-layer">
        <span aria-hidden="true" className="font-mono text-[0.8125rem] text-neutral-600">
          $
        </span>
        <span className="mx-1 font-mono text-[0.8125rem] text-neutral-900">{INSTALL}</span>
        <CopyButton value={INSTALL} />
      </div>
      {note ? <p className="text-[0.8125rem] text-neutral-600">{note}</p> : null}
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
              href="#try"
            >
              Try it
            </a>
            <a
              className="rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium text-neutral-600 tint hover:bg-blush hover:text-neutral-900"
              href="#how"
            >
              How it works
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
        <section className="mx-auto max-w-[44rem] pt-16 text-center sm:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1 text-[0.75rem] font-medium text-neutral-600">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-rose-500" />
            New — one comment for several elements
          </span>
          <h1 className="mt-6 text-balance font-display text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-[4.5rem] sm:leading-[1.0]">
            One note for <span className="text-brand-ink">the whole set.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-[30rem] text-pretty text-[1rem] leading-relaxed text-neutral-600">
            Edityy is a visual editing layer for the site you already run. Select one element or
            several, write a single note, and your agent reads them as one combined change.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#try"
              className="rounded-lg bg-neutral-900 px-6 py-3 text-[0.9375rem] font-medium text-neutral-50 tint hover:bg-neutral-700"
            >
              Try it below — it&apos;s live
            </a>
            <Link
              href="/docs"
              className="rounded-lg border border-neutral-200 bg-white px-6 py-3 text-[0.9375rem] font-medium text-neutral-900 tint hover:border-neutral-300"
            >
              View docs →
            </Link>
          </div>
        </section>

        <section id="try" className="mx-auto mt-14 max-w-[52rem] scroll-mt-28 sm:mt-16">
          <CommentDemo />
          <p className="mt-4 text-center text-[0.8125rem] leading-relaxed text-neutral-600">
            That is the branch behavior, running on this page: Shift-click builds the set, one box
            holds the note, and the save lands on every selected element. Open source · MIT · zero
            dependencies.
          </p>
        </section>

        <section id="how" className="scroll-mt-28 pt-20 sm:pt-24">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-4 max-w-[32rem] text-balance font-display text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[2.5rem]">
            Select, say it, <span className="text-brand-ink">ship it as code</span>
          </h2>
          <ol className="mt-10 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {steps.map((step, i) => (
              <li key={step.title} className="border-t border-neutral-200 pt-5">
                <span className="font-mono text-[0.75rem] text-brand-ink">{`0${i + 1}`}</span>
                <h3 className="mt-3 text-[1rem] font-semibold tracking-[-0.02em]">{step.title}</h3>
                <p className="mt-2 max-w-[22rem] text-[0.875rem] leading-relaxed text-neutral-600">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-100 px-4 py-3 text-[0.8125rem] text-neutral-600">
            <span className="font-medium text-neutral-900">Sent → Select → Ready</span>
            <span aria-hidden="true" className="text-neutral-300">·</span>
            <span>Sent waits for the agent, Select waits for your pick, Ready waits for the agent to write the code.</span>
          </div>
        </section>

        <section id="features" className="mt-20 scroll-mt-28 border-t border-neutral-200 pt-16 sm:mt-24 sm:pt-20">
          <Eyebrow>What you can change</Eyebrow>
          <h2 className="mt-4 max-w-[34rem] text-balance font-display text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[2.5rem]">
            The whole page, in the browser you already have open.
          </h2>
          <ul className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <li key={feature.title} className="group">
                <span className="flex size-9 items-center justify-center rounded-lg border border-neutral-200 bg-blush text-neutral-900 lift group-hover:-translate-y-0.5 group-hover:border-neutral-300 group-hover:bg-rose">
                  <Icon name={feature.icon} />
                </span>
                <h3 className="mt-4 text-[0.9375rem] font-semibold tracking-[-0.02em]">{feature.title}</h3>
                <p className="mt-2 text-[0.875rem] leading-relaxed text-neutral-600">{feature.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="agent" className="mt-20 scroll-mt-28 sm:mt-24">
          <div className="layer overflow-hidden rounded-2xl px-6 py-12 sm:px-10 sm:py-14">
            <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-start">
              <div>
                <Eyebrow>Hand-off</Eyebrow>
                <h2 className="mt-4 text-balance font-display text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[2.5rem]">
                  Your code stays the source of truth.
                </h2>
                <p className="mt-4 max-w-[26rem] text-[0.9375rem] leading-relaxed text-neutral-600">
                  Edityy never writes your source. It writes down what changed — the selector, the
                  source line, each value — and your agent makes the change in the file.
                </p>
                <ul className="mt-8 divide-y divide-neutral-200 border-y border-neutral-200">
                  {handoffs.map((handoff) => (
                    <li key={handoff.label} className="py-4">
                      <p className="text-[0.875rem] font-medium">{handoff.label}</p>
                      <p className="mt-1 text-[0.875rem] leading-relaxed text-neutral-600">{handoff.body}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div aria-hidden="true" className="rounded-xl border border-neutral-200 bg-neutral-100 p-4">
                <p className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-neutral-500">
                  .edityy/changes.json
                </p>
                <pre className="mt-3 overflow-x-auto font-mono text-[0.6875rem] leading-relaxed text-neutral-700">{`{
  "page": "/",
  "changes": [
    {
      "selector": ".card",
      "source": "app/page.tsx:41:8",
      "comment": "Make all three calm",
      "props": [
        { "prop": "padding", "after": "24px" },
        { "prop": "border", "after": "1px solid …" }
      ]
    }
  ]
}`}</pre>
                <p className="mt-3 border-t border-neutral-200 pt-3 font-mono text-[0.625rem] text-neutral-500">
                  ×3 — the same note on each selected element
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="install" className="mt-20 scroll-mt-28 border-t border-neutral-200 pt-16 text-center sm:mt-24 sm:pt-20">
          <h2 className="mx-auto max-w-[30rem] text-balance font-display text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[2.5rem]">
            Ready when your dev server is.
          </h2>
          <p className="mx-auto mt-4 max-w-[30rem] text-[0.9375rem] leading-relaxed text-neutral-600">
            Install the package, add one line, and reload the page. The launcher settles in the
            bottom-right corner — Alt+E opens it from the keyboard.
          </p>
          <div className="mt-9">
            <Install />
          </div>
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
