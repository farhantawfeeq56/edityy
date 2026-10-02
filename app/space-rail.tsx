"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";

const TILES = ["bg-mint", "bg-butter", "bg-lilac"];

/* Fixed class list rather than an inline transform, so Tailwind can see it. */
const FAN = ["-rotate-3", "-rotate-2", "rotate-0", "rotate-2", "rotate-3"];

const initial = (value: string) => value.trim().charAt(0).toUpperCase() || "?";

type Space = { id: string; name: string; component_count: number };

const meta = (space: Space) =>
  `${space.component_count} ${space.component_count === 1 ? "component" : "components"}`;

/** A chevron, drawn rather than typed: the glyphs sat off-centre in the circle. */
const Chevron = ({ side }: { side: "left" | "right" }) => (
  <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d={side === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
  </svg>
);

function NavButton({ side, label, onClick }: { side: "left" | "right"; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100/90 text-neutral-900 shadow-sm backdrop-blur transition-colors hover:border-neutral-300"
    >
      <Chevron side={side} />
    </button>
  );
}

/**
 * The spaces as a fanned deck: cards overlap and sit at an angle, and the deck
 * moves by its own arrow keys or buttons rather than a scrollbar.
 *
 * ponytail: one deck, horizontal scroll only — no drag, no reorder. Add when a
 * space is genuinely re-orderable.
 */
export function SpaceRail({ spaces }: { spaces: Space[] }) {
  const railRef = useRef<HTMLUListElement>(null);

  const nudge = useCallback((direction: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.scrollBy({ left: direction * rail.clientWidth * 0.85, behavior: reduced ? "auto" : "smooth" });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable=true]")) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      nudge(event.key === "ArrowLeft" ? -1 : 1);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nudge]);

  return (
    <div className="relative mt-2">
      <ul
        ref={railRef}
        className="-mx-6 flex snap-x snap-mandatory items-end gap-4 overflow-x-auto px-6 pt-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {spaces.map((space, index) => (
          <li key={space.id} className={`relative shrink-0 snap-start scroll-ml-4 ${index > 0 ? "-ml-12" : ""}`}>
            <Link
              href={`/spaces/${space.id}`}
              className={`flex h-60 w-52 origin-bottom flex-col justify-between rounded-xl p-4 shadow-[0_8px_24px_-12px_rgba(17,17,17,0.4)] transition-transform hover:z-20 hover:rotate-0 ${TILES[index % TILES.length]} ${FAN[index % FAN.length]}`}
            >
              <span aria-hidden className="text-5xl font-bold leading-none text-neutral-900/20">
                {initial(space.name)}
              </span>
              <span>
                <span className="block truncate text-base font-semibold tracking-tight">{space.name}</span>
                <span className="mt-1 block text-xs text-neutral-900/60">{meta(space)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="absolute top-1/2 left-0 z-30 -translate-y-1/2">
        <NavButton side="left" label="Previous spaces" onClick={() => nudge(-1)} />
      </div>
      <div className="absolute top-1/2 right-0 z-30 -translate-y-1/2">
        <NavButton side="right" label="Next spaces" onClick={() => nudge(1)} />
      </div>
    </div>
  );
}

export { TILES, initial };