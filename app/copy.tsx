"use client";

import { useEffect, useRef, useState } from "react";

// The only client code on the page: a command that says it was copied. The words
// stay in one live region, so a reader hears the change and the button never
// moves. A browser that refuses the clipboard leaves the command as it is — it
// is selectable text either way.
export function CopyButton({
  value,
  label = "Copy",
  className = "text-neutral-600 hover:bg-blush hover:text-neutral-900",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // Nothing to say: the command is on the page and can be selected by hand.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`rounded-lg px-3 py-1.5 text-[0.75rem] font-medium tint ${className}`}
    >
      {/* The words change in place. The live region is the outer span, so it
          is the same region before and after: a reader hears the change, and
          the new words rise into the place the old ones left. The key is what
          makes the rise happen again. */}
      <span aria-live="polite">
        <span key={copied ? "copied" : "idle"} className="say">
          {copied ? "Copied" : label}
        </span>
      </span>
    </button>
  );
}
