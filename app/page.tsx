import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-20">
      <p className="text-sm font-medium text-neutral-500">A visual editing layer for code-based websites</p>
      <h1 className="mt-4">Edityy</h1>
      <p className="mt-6 text-base text-neutral-600">
        Install the package, add one line to your dev server, and the Edityy launcher appears in the bottom-right of
        the site you are already running. Your codebase stays the source of truth.
      </p>

      <pre className="mt-8 overflow-x-auto rounded-md border border-neutral-200 bg-neutral-100 p-4 font-mono text-sm">
        npm install -D edityy
      </pre>

      <p className="mt-6 text-sm text-neutral-500">
        Setup for each dev server, and what the launcher does:{" "}
        <a className="underline" href="https://www.npmjs.com/package/edityy" target="_blank" rel="noreferrer">
          the edityy README
        </a>
        .
      </p>
      <p className="mt-2 text-sm text-neutral-500">
        <Link className="underline" href="https://github.com/farhantawfeeq56/edityy">
          Source
        </Link>{" "}
        · V1 is the launcher only. The editor panel is not built yet.
      </p>
    </main>
  );
}