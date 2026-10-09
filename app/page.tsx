import Link from "next/link";

const features = [
  {
    title: "Edit the page",
    description: "Select text, containers or media. Edit text on demand and change typography, colour, spacing and box styles.",
  },
  {
    title: "Arrange elements",
    description: "Create or move elements, select their parent or child, and delete them. Shift-click siblings and press Shift+A to make a column layout.",
  },
  {
    title: "Keep control",
    description: "Undo and redo style changes. Review each edit, select its element or revert it before you leave edit mode.",
  },
  {
    title: "Use your fonts",
    description: "Search fonts already on the page or browse Google Fonts. Edityy loads a font only when you preview or choose it.",
  },
  {
    title: "Hand changes to code",
    description: "Copy edits as a prompt or save them to your project. Your source code stays the source of truth.",
  },
  {
    title: "Work with your agent",
    description: "Use the Edityy MCP server to share saved visual changes with coding agents such as Claude Code and Cursor.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-6 py-20">
      <p className="text-sm font-medium text-neutral-500">A visual editing layer for code-based websites</p>
      <h1 className="mt-4">Shape the page. Keep the code.</h1>
      <p className="mt-6 max-w-2xl text-base leading-relaxed text-neutral-600">
        Edityy adds a visual editor to your development server. Edit content and styles on the page, arrange elements,
        and hand your changes to the codebase when they are ready.
      </p>

      <pre className="mt-8 overflow-x-auto rounded-md border border-neutral-200 bg-neutral-100 p-4 font-mono text-sm">
        npm install -D edityy
      </pre>

      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Edityy features">
        {features.map((feature) => (
          <article key={feature.title} className="rounded-lg border border-neutral-200 p-4">
            <h2 className="text-base font-semibold">{feature.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{feature.description}</p>
          </article>
        ))}
      </section>

      <p className="mt-8 text-sm text-neutral-500">
        Add Edityy to Vite, Express or Next.js. Read the {" "}
        <a className="underline" href="https://www.npmjs.com/package/edityy" target="_blank" rel="noreferrer">
          setup guide and full feature details
        </a>
        .
      </p>
      <p className="mt-2 text-sm text-neutral-500">
        <Link className="underline" href="https://github.com/farhantawfeeq56/edityy">
          View the source on GitHub
        </Link>
      </p>
    </main>
  );
}
