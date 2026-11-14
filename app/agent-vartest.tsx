"use client";

import { useEffect, useState } from "react";

const promptSample = `# Visual edits from Edityy

Apply these edits to the source code. Change the code
that renders each element, in the styling approach
the project already uses.

## 1. Heading
- Selector: \`h1.hero-title\`
- Source: \`src/App.tsx:12:7\`
- \`font-size\`: \`44px\` → \`52px\`
- \`color\`: \`#16233a\` → \`#2f5fa8\``;

const variants = ["Quiet dark", "Paper pop", "Gold line", "Window", "Outline"] as const;

const outer: string[] = [
  "rounded-xl border border-neutral-50/10 bg-neutral-50/[0.04] p-1",
  "rounded-xl border border-transparent bg-neutral-50 p-1 shadow-layer",
  "rounded-xl border border-neutral-50/10 bg-neutral-50/[0.04] p-1",
  "rounded-2xl border border-neutral-50/15 bg-black/40 p-1 shadow-layer",
  "rounded-xl border border-dashed border-neutral-50/25 bg-transparent p-1",
];

const head: string[] = [
  "flex items-center gap-2 px-3 py-2 text-[0.6875rem] text-neutral-50/50",
  "flex items-center gap-2 px-3 py-2 text-[0.6875rem] text-neutral-600",
  "flex items-center gap-2 px-3 py-2 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-neutral-50/60",
  "flex items-center gap-2 px-3 py-2 text-[0.6875rem] text-neutral-50/60",
  "flex items-center gap-2 px-3 py-2 text-[0.6875rem] text-neutral-50/50",
];

const dot: string[] = [
  "size-1.5 rounded-full bg-rose-500",
  "size-1.5 rounded-full bg-brand",
  "size-1.5 rounded-full bg-brand",
  "size-2.5 rounded-full bg-neutral-50/20",
  "size-1.5 rounded-full border border-neutral-50/40",
];

const pre: string[] = [
  "overflow-x-auto rounded-lg bg-neutral-900 p-4 font-mono text-[0.75rem] leading-[1.7] text-neutral-50/80",
  "overflow-x-auto rounded-lg border border-neutral-200 bg-white p-4 font-mono text-[0.75rem] leading-[1.7] text-neutral-700",
  "overflow-x-auto rounded-lg border-l-2 border-l-brand bg-neutral-900 p-4 font-mono text-[0.75rem] leading-[1.7] text-neutral-50/80",
  "overflow-x-auto rounded-lg bg-black/30 p-4 font-mono text-[0.75rem] leading-[1.7] text-neutral-50/80",
  "overflow-x-auto rounded-lg border border-neutral-50/10 bg-transparent p-4 font-mono text-[0.75rem] leading-[1.7] text-neutral-50/80",
];

const foot: string[] = [
  "flex items-center gap-2 border-t border-neutral-50/10 px-3 py-2.5 font-mono text-[0.6875rem] text-neutral-50/60",
  "flex items-center gap-2 border-t border-neutral-200 px-3 py-2.5 font-mono text-[0.6875rem] text-neutral-600",
  "flex items-center gap-2 border-t border-neutral-50/10 px-3 py-2.5 font-mono text-[0.6875rem] text-neutral-50/60",
  "flex items-center gap-2 border-t border-neutral-50/10 px-3 py-2.5 font-mono text-[0.6875rem] text-neutral-50/60",
  "flex items-center gap-2 border-t border-dashed border-neutral-50/20 px-3 py-2.5 font-mono text-[0.6875rem] text-neutral-50/60",
];

/** The handoff code card in the #agent section, with 5 live variants. Keys 1-5 switch. */
export function AgentCardVartest() {
  const [variant, setVariant] = useState(0);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if ((event.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable=true]")) return;
      const index = Number(event.key) - 1;
      if (index >= 0 && index < variants.length) setVariant(index);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <div aria-hidden="true" className={outer[variant]}>
        {variant === 2 ? <span className="mx-3 mt-2 block h-px bg-brand" /> : null}
        <div className={head[variant]}>
          {variant === 3 ? (
            <>
              <span className={dot[variant]} />
              <span className={dot[variant]} />
              <span className={dot[variant]} />
              <span className="ml-1">edityy — prompt</span>
            </>
          ) : (
            <>
              <span className={dot[variant]} />
              copied as a prompt to use with your coding agents
            </>
          )}
        </div>
        <pre className={pre[variant]}>{promptSample}</pre>
        <div className={foot[variant]}>
          <span className="text-neutral-50/40">$</span>
          npx edityy mcp
        </div>
      </div>
      <nav
        aria-label="Handoff card styles"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border border-neutral-200 bg-white/95 py-1.5 pl-3 pr-1.5 shadow-layer backdrop-blur"
      >
        <span className="text-[0.6875rem] font-medium text-neutral-600">Card · {variant + 1}/5</span>
        <div role="group" aria-label="Choose a card style" className="flex gap-0.5">
          {variants.map((name, index) => (
            <button
              key={name}
              type="button"
              aria-label={`${index + 1}: ${name}`}
              aria-pressed={variant === index}
              onClick={() => setVariant(index)}
              className={`size-7 rounded-full text-[0.6875rem] font-semibold tint ${
                variant === index ? "bg-neutral-900 text-neutral-50" : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {index + 1}
            </button>
          ))}
        </div>
        <span className="hidden pr-1 text-[0.6875rem] text-neutral-500 sm:inline">{variants[variant]}</span>
      </nav>
    </>
  );
}
