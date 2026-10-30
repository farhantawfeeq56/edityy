import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { CopyButton } from "./copy";
import logo from "./logo.png";

const INSTALL = "npm install -D edityy";
const NPM = "https://www.npmjs.com/package/edityy";
const GITHUB = "https://github.com/farhantawfeeq56/edityy";

const steps = [
  {
    title: "Install Edityy",
    body: "Add the plugin to your dev server. A launcher appears in the bottom-right corner of the page you already run.",
  },
  {
    title: "Point and edit",
    body: "Pick an element. The dock changes its type, colour, spacing, fill, border and shadow. Each edit is one inline style.",
  },
  {
    title: "Hand over the edits",
    body: "Copy the edits as a prompt, save them to the project, or let an agent read them over MCP. Your code does the rest.",
  },
];

const features = [
  {
    icon: "cursor",
    title: "Edit the page",
    body: "Select text, a container or media. Type new words. Change typography, colour, spacing and box styles.",
  },
  {
    icon: "grid",
    title: "Arrange elements",
    body: "Add, move and delete elements. Shift-click siblings and press Shift+A for a column.",
  },
  {
    icon: "undo",
    title: "Undo with trust",
    body: "Undo and redo style changes. Review each edit, select its element, or revert it before you leave the mode.",
  },
  {
    icon: "type",
    title: "Use your own fonts",
    body: "Search the fonts already on the page, or browse Google Fonts. Edityy loads a face only when you preview or pick it.",
  },
  {
    icon: "code",
    title: "Hand changes to code",
    body: "Copy the edits as a prompt, or save them to your project. The source code stays the source of truth.",
  },
  {
    icon: "agent",
    title: "Work with your agent",
    body: "The Edityy MCP server shares saved changes with coding agents such as Claude Code and Cursor.",
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
  type: "M5 6h14M12 6v13M9 19h6",
  code: "M9 8l-5 4 5 4M15 8l5 4-5 4",
  agent: "M12 4l1.9 4.3L18 10l-4.1 1.7L12 16l-1.9-4.3L6 10l4.1-1.7z",
};

const promptSample = `# Visual edits from Edityy

Apply these edits to the source code. Change the code
that renders each element, in the styling approach
the project already uses.

## 1. Heading
- Selector: \`h1.hero-title\`
- Source: \`src/App.tsx:12:7\`
- \`font-size\`: \`44px\` → \`52px\`
- \`color\`: \`#16233a\` → \`#2f5fa8\``;

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

function Eyebrow({ children, inverted = false }: { children: ReactNode; inverted?: boolean }) {
  return (
    <p
      className={`flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.12em] ${
        inverted ? "text-white/60" : "text-neutral-500"
      }`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
      {children}
    </p>
  );
}

function Install({ note }: { note?: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white py-1 pl-4 pr-1 shadow-layer">
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
              href="#how"
            >
              How it works
            </a>
            <a
              className="rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium text-neutral-600 tint hover:bg-blush hover:text-neutral-900"
              href="#features"
            >
              Features
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
        <section className="pt-16 text-center sm:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-[0.75rem] font-medium text-neutral-600">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-rose-500" />
            Open source, MIT licensed
          </span>

          <h1 className="mx-auto mt-7 max-w-[44rem] text-balance font-display text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-[4.25rem]">
            Shape the page.
            <br />
            <span className="text-brand-ink">Keep the code.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-[34rem] text-pretty text-[1rem] leading-relaxed text-neutral-600">
            Edityy puts a visual editor on the site you already run. Point at an element. Change the type, the colour,
            the spacing and the fill. Then hand the edits to your code.
          </p>

          <div className="mt-9">
            <Install note="One line of config for Vite, Express or Next.js." />
          </div>

          <p className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[0.8125rem] font-medium">
            <Link className="text-neutral-900 underline decoration-neutral-300 underline-offset-4 tint hover:decoration-neutral-900" href="/docs">
              Setup guide and full details
            </Link>
            <a className="text-neutral-600 underline decoration-neutral-300 underline-offset-4 tint hover:text-neutral-900 hover:decoration-neutral-900" href={GITHUB} target="_blank" rel="noreferrer">
              View the source
            </a>
          </p>
        </section>

        <section id="how" className="scroll-mt-28 pt-40">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-4 max-w-[32rem] text-balance font-display text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[2.5rem]">
            One install, then the page answers to you.
          </h2>
          <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {steps.map((step, i) => (
              <li key={step.title} className="border-t border-neutral-200 pt-5">
                <span className="font-mono text-[0.75rem] text-brand-ink">{`0${i + 1}`}</span>
                <h3 className="mt-3 text-[1rem] font-semibold tracking-[-0.02em]">{step.title}</h3>
                <p className="mt-2 max-w-[22rem] text-[0.875rem] leading-relaxed text-neutral-600">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="features" className="mt-20 scroll-mt-28 border-t border-neutral-200 pt-16 sm:mt-24 sm:pt-20">
          <Eyebrow>What you can change</Eyebrow>
          <h2 className="mt-4 max-w-[32rem] text-balance font-display text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[2.5rem]">
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
          <div className="overflow-hidden rounded-2xl bg-neutral-900 px-6 py-12 text-white sm:px-10 sm:py-14">
            <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-16">
              <div>
                <Eyebrow inverted>Hand-off</Eyebrow>
                <h2 className="mt-4 text-balance font-display text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[2.5rem]">
                  Your code stays the source of truth.
                </h2>
                <p className="mt-4 max-w-[26rem] text-[0.9375rem] leading-relaxed text-white/70">
                  Edityy does not write to your source. It writes down what you changed. Your agent makes the change in
                  the file, in the way the project already styles things.
                </p>
                <ul className="mt-8 divide-y divide-white/10 border-y border-white/10">
                  {handoffs.map((handoff) => (
                    <li key={handoff.label} className="py-4">
                      <p className="text-[0.875rem] font-medium">{handoff.label}</p>
                      <p className="mt-1 text-[0.875rem] leading-relaxed text-white/60">{handoff.body}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div aria-hidden="true" className="rounded-xl border border-white/10 bg-white/[0.04] p-1">
                <div className="flex items-center gap-2 px-3 py-2 text-[0.6875rem] text-white/50">
                  <span className="size-1.5 rounded-full bg-rose-500" />
                  copied as a prompt to use with your coding agents
                </div>
                <pre className="overflow-x-auto rounded-lg bg-neutral-900 p-4 font-mono text-[0.75rem] leading-[1.7] text-white/80">
                  {promptSample}
                </pre>
                <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5 font-mono text-[0.6875rem] text-white/60">
                  <span className="text-white/40">$</span>
                  npx edityy mcp
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="install" className="mt-20 scroll-mt-28 border-t border-neutral-200 pt-16 text-center sm:mt-24 sm:pt-20">
          <h2 className="mx-auto max-w-[30rem] text-balance font-display text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[2.5rem]">
            Ready when your dev server is.
          </h2>
          <p className="mx-auto mt-4 max-w-[30rem] text-[0.9375rem] leading-relaxed text-neutral-600">
            Install the package, add one line, and reload the page. The launcher is in the bottom-right corner.
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
