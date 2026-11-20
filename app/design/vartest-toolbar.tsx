"use client";

import { useCallback, useEffect, useState } from "react";

/** Slot 25px plus 2px gap: the thumb moves by arithmetic, after interior.dev's Pagination. */
const STEP = 27;

/** A variant index, plus the direction it arrived from for the roll. */
export function useVartestSwitch(count: number, initial = 0) {
  const [state, setState] = useState({ index: initial, direction: 1 as 1 | -1 });
  // Keys and clicks share this setter, so both run the same animation.
  const goTo = useCallback(
    (next: number) => {
      if (!Number.isInteger(next) || next < 0 || next >= count) return;
      setState((prev) => (next === prev.index ? prev : { index: next, direction: next >= prev.index ? 1 : -1 }));
    },
    [count],
  );
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if ((event.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable=true]")) return;
      goTo(event.key === "0" ? 9 : Number(event.key) - 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [count, goTo]);
  return { index: state.index, direction: state.direction, goTo };
}

/** The floating segmented toolbar. One thumb travels between fixed slots. */
export function VartestToolbar({
  label,
  index,
  names,
  onSwitch,
  className = "",
}: {
  label: string;
  index: number;
  names: readonly string[];
  onSwitch: (index: number) => void;
  className?: string;
}) {
  // Each button shows the key that picks it: 0 for the tenth slot.
  const cap = (i: number) => (names.length === 10 && i === 9 ? 0 : i + 1);
  return (
    <nav className={`edy-count-vartest${className ? ` ${className}` : ""}`} aria-label={`${label} styles`}>
      <span className="edy-count-vartest-label">
        {label} · {index + 1}/{names.length}
      </span>
      <div className="edy-vartest-bar" role="group" aria-label={`Choose a ${label.toLowerCase()}`}>
        <span aria-hidden="true" className="edy-vartest-thumb" style={{ transform: `translateX(${index * STEP}px)` }} />
        {names.map((name, i) => (
          <button
            key={name}
            type="button"
            aria-label={`${cap(i)}: ${name}`}
            aria-pressed={index === i}
            onClick={() => onSwitch(i)}
          >
            {cap(i)}
          </button>
        ))}
      </div>
      <span className="edy-count-vartest-name">{names[index]}</span>
    </nav>
  );
}

/**
 * The variant surface. The parent keys it by index, so each switch remounts
 * it and the new variant rolls in from the travel direction.
 */
export function VartestView({ direction, children }: { direction: 1 | -1; children: React.ReactNode }) {
  return <div className={`edy-vartest-view${direction < 0 ? " is-back" : ""}`}>{children}</div>;
}
