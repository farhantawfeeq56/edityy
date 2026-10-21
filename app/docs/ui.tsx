import type { ReactNode } from "react";

// The building blocks every docs page uses. The site has no markdown pipeline,
// so the prose is written as components: one place for the type, one place for
// the code block, one place for the note.

export function H1({ children }: { children: ReactNode }) {
  return (
    <h1 className="text-[2rem] font-semibold leading-[1.1] tracking-[-0.035em] text-neutral-900 sm:text-[2.375rem]">
      {children}
    </h1>
  );
}

export function Lead({ children }: { children: ReactNode }) {
  return <p className="mt-5 text-[1.0625rem] leading-relaxed text-neutral-600">{children}</p>;
}

export function H2({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="mt-14 scroll-mt-28 border-t border-neutral-200 pt-8 text-[1.375rem] font-semibold tracking-[-0.025em] text-neutral-900 sm:text-[1.5rem]"
    >
      {children}
    </h2>
  );
}

export function H3({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h3 id={id} className="mt-8 scroll-mt-28 text-[1rem] font-semibold tracking-[-0.02em] text-neutral-900">
      {children}
    </h3>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-[0.9375rem] leading-relaxed text-neutral-600">{children}</p>;
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="mt-4 space-y-2.5 text-[0.9375rem] leading-relaxed text-neutral-600">{children}</ul>;
}

export function OL({ children }: { children: ReactNode }) {
  return <ol className="mt-4 space-y-2.5 text-[0.9375rem] leading-relaxed text-neutral-600">{children}</ol>;
}

export function LI({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="mt-[0.6875rem] size-1 shrink-0 rounded-full bg-neutral-300" />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/** A word in the running text that names code: a property, a file, a command. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-blush px-1.5 py-0.5 font-mono text-[0.8125rem] text-neutral-900">{children}</code>
  );
}

/** A block of code, with the file it belongs to above it. */
export function Pre({ children, file }: { children: string; file?: string }) {
  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-neutral-200 bg-white">
      {file ? (
        <p className="border-b border-neutral-200 px-4 py-2 font-mono text-[0.6875rem] text-neutral-500">{file}</p>
      ) : null}
      <pre className="overflow-x-auto p-4 font-mono text-[0.8125rem] leading-[1.7] text-neutral-900">
        <code>{children}</code>
      </pre>
    </div>
  );
}

/** A rule the reader must not break, or a limit they must know. */
export function Note({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6 rounded-xl border border-neutral-200 bg-blush/60 px-5 py-4">
      <p className="text-[0.8125rem] font-semibold text-neutral-900">{title}</p>
      <div className="mt-1.5 text-[0.875rem] leading-relaxed text-neutral-600">{children}</div>
    </div>
  );
}

/** A table of facts: options, exports, limits. */
export function Table({
  head,
  rows,
}: {
  head: [string, string];
  rows: [ReactNode, ReactNode][];
}) {
  return (
    <div className="mt-5 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <table className="w-full border-collapse text-left text-[0.875rem]">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className="px-4 py-2.5 font-semibold text-neutral-900">{head[0]}</th>
            <th className="px-4 py-2.5 font-semibold text-neutral-900">{head[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([a, b], i) => (
            <tr key={i} className="border-b border-neutral-200 last:border-0">
              <td className="px-4 py-2.5 align-top text-neutral-900">{a}</td>
              <td className="px-4 py-2.5 align-top leading-relaxed text-neutral-600">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
