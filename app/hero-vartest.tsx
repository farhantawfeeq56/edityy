"use client";

import { useEffect, useState } from "react";

const base = "mx-auto mt-7 max-w-[44rem] text-balance font-display text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-[5.25rem] sm:leading-[86px]";
const ink = "text-brand-ink";

const names = [
  "Gold marker",
  "Pill badge",
  "Underline stroke",
  "Mono tag",
  "Sparkle icons",
  "Two tone split",
  "Strike swap",
  "Quote chip",
  "Arrow link",
  "Dot leaders",
] as const;

function Variant({ index }: { index: number }) {
  switch (index) {
    case 0:
      return (
        <h1 className={base}>
          Shape the{" "}
          <span style={{ background: "linear-gradient(transparent 60%, #f5d76e 60%)" }}>page.</span>
          <br />
          <span className={ink}>Keep the code.</span>
        </h1>
      );
    case 1:
      return (
        <h1 className={base}>
          <span
            style={{
              display: "inline-block",
              fontSize: "0.32em",
              verticalAlign: "middle",
              border: "1px solid currentColor",
              borderRadius: "999px",
              padding: "0.1em 0.6em",
              marginRight: "0.6em",
            }}
          >
            New
          </span>
          Shape the page.
          <br />
          <span className={ink}>Keep the code.</span>
        </h1>
      );
    case 2:
      return (
        <h1 className={base}>
          Shape the page.
          <br />
          <span className={ink} style={{ textDecoration: "underline", textDecorationThickness: "0.08em", textUnderlineOffset: "0.15em" }}>
            Keep the code.
          </span>
        </h1>
      );
    case 3:
      return (
        <h1 className={base}>
          Shape the page.
          <br />
          <span className={ink}>
            Keep the{" "}
            <code style={{ fontSize: "0.7em", border: "1px solid currentColor", borderRadius: "0.3em", padding: "0 0.3em" }}>
              code.
            </code>
          </span>
        </h1>
      );
    case 4:
      return (
        <h1 className={base}>
          <span aria-hidden="true">✦ </span>Shape the page.
          <br />
          <span className={ink}>
            Keep the code.<span aria-hidden="true"> ✦</span>
          </span>
        </h1>
      );
    case 5:
      return (
        <h1 className={base}>
          Shape the <em style={{ fontStyle: "normal", color: "#b45309" }}>page.</em>
          <br />
          <span className={ink}>
            Keep the <strong>code.</strong>
          </span>
        </h1>
      );
    case 6:
      return (
        <h1 className={base}>
          Shape the <s style={{ opacity: 0.5 }}>site.</s> <span>page.</span>
          <br />
          <span className={ink}>Keep the code.</span>
        </h1>
      );
    case 7:
      return (
        <h1 className={base}>
          <span aria-hidden="true" style={{ opacity: 0.4 }}>
            “
          </span>
          Shape the page.
          <br />
          <span className={ink}>Keep the code.</span>
          <span aria-hidden="true" style={{ opacity: 0.4 }}>
            ”
          </span>
        </h1>
      );
    case 8:
      return (
        <h1 className={base}>
          Shape the page <span aria-hidden="true">→</span>
          <br />
          <span className={ink}>Keep the code.</span>
        </h1>
      );
    default:
      return (
        <h1 className={base}>
          Shape the page.
          <br />
          <span className={ink} style={{ fontSize: "0.5em", letterSpacing: "0.2em" }}>
            ● ● ●
          </span>
          <br />
          <span className={ink}>Keep the code.</span>
        </h1>
      );
  }
}

/** Temporary vartest for the landing hero. Keys 1-9 and 0 switch variants. */
export function HeroVartest() {
  const [variant, setVariant] = useState(0);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if ((event.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable=true]")) return;
      const index = event.key === "0" ? 9 : Number(event.key) - 1;
      if (index >= 0 && index < names.length) setVariant(index);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <Variant index={variant} />
      <nav
        aria-label="Hero variants"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border border-neutral-200 bg-white/90 py-1.5 pl-4 pr-1.5 shadow-lg backdrop-blur"
      >
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-neutral-500">
          Hero · {variant + 1}/10
        </span>
        <div role="group" aria-label="Choose a hero variant" className="flex items-center gap-1">
          {names.map((name, index) => (
            <button
              key={name}
              type="button"
              aria-label={`${index === 9 ? 0 : index + 1}: ${name}`}
              aria-pressed={variant === index}
              onClick={() => setVariant(index)}
              className={`size-7 rounded-full font-mono text-[0.75rem] transition-colors ${
                variant === index
                  ? "bg-neutral-900 text-neutral-50"
                  : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              }`}
            >
              {index === 9 ? 0 : index + 1}
            </button>
          ))}
        </div>
        <span className="pr-2 text-[0.75rem] font-medium text-neutral-900">{names[variant]}</span>
      </nav>
    </>
  );
}
