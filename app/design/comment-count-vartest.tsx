"use client";

import { useEffect, useState } from "react";

const variants = [
  "Gold circle", "Gold square", "Gold pill", "Outline circle", "Ink circle", "Ink pill", "Soft gold square", "Outline square", "Square mark", "Minimal",
] as const;

/** The saved-change count badge, shown on this heading for visual testing. */
export function ChangeCountBadgeVartest() {
  const [variant, setVariant] = useState(6);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if ((event.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable=true]")) return;
      const index = event.key === "0" ? 9 : Number(event.key) - 1;
      if (index >= 0 && index < variants.length) setVariant(index);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <h1 className="edy-hero-title">
        Keep the page<br />in <em>view.</em>
        <span className={`edy-change-count edy-change-count-${variant + 1}`} aria-label="3 saved changes">3</span>
      </h1>
      <nav className="edy-count-vartest" aria-label="Change count badge styles">
        <span className="edy-count-vartest-label">Badge · {variant + 1}/10</span>
        <div role="group" aria-label="Choose a badge style">
          {variants.map((name, index) => (
            <button
              key={name}
              type="button"
              aria-label={`${index + 1}: ${name}`}
              aria-pressed={variant === index}
              onClick={() => setVariant(index)}
            >
              {index + 1}
            </button>
          ))}
        </div>
        <span className="edy-count-vartest-name">{variants[variant]}</span>
      </nav>
    </>
  );
}
