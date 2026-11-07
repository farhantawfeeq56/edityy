"use client";

import { useCallback, useEffect, useState } from "react";

// Landing page colour vartest (digits 1-0): five light, five dark, each in
// its own hue. The switch sets data-vartest on <html>; globals.css swaps
// the page ramp only, so the package is untouched.
const THEMES = [
  { id: "light", label: "Light" },
  { id: "blue", label: "Blue" },
  { id: "green", label: "Green" },
  { id: "rose", label: "Rose" },
  { id: "teal", label: "Teal" },
  { id: "dark", label: "Dark" },
  { id: "midnight", label: "Midnight" },
  { id: "forest", label: "Forest" },
  { id: "plum", label: "Plum" },
  { id: "slate", label: "Slate" },
];

// Package light/dark vartest (L/D): sets data-package on <html>.
// globals.css swaps only the seven --edityy-* values, so the landing page
// is untouched and every chrome element (dock, comment box, menus) moves.
const PACKAGES = [
  { id: "light", label: "Light", key: "l" },
  { id: "dark", label: "Dark", key: "d" },
];

// Package palette vartest (Q-P): sets data-palette on <html>. Only the
// brand family moves, so L/D still decides light or dark on top of it.
// The bounding box is the brand colour, so it follows the palette.
const PALETTES = [
  { id: "gold", key: "q", label: "Gold", color: "#d4a72c" },
  { id: "blue", key: "w", label: "Blue", color: "#2f6fb2" },
  { id: "green", key: "e", label: "Green", color: "#4a7c3a" },
  { id: "rose", key: "r", label: "Rose", color: "#c2526e" },
  { id: "violet", key: "t", label: "Violet", color: "#6d55c0" },
  { id: "teal", key: "y", label: "Teal", color: "#2e8c7a" },
  { id: "orange", key: "u", label: "Orange", color: "#d9662b" },
  { id: "magenta", key: "i", label: "Magenta", color: "#a61e6e" },
  { id: "red", key: "o", label: "Red", color: "#c92a2a" },
  { id: "slate", key: "p", label: "Slate", color: "#3f3f46" },
];

function typing(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null;
  return Boolean(target?.closest("input, textarea, select, [contenteditable=\"true\"]"));
}

export function Vartest() {
  const [active, setActive] = useState("light");
  const [pkg, setPkg] = useState("light");
  const [palette, setPalette] = useState("gold");

  useEffect(() => {
    document.documentElement.dataset.vartest = active;
  }, [active]);

  useEffect(() => {
    document.documentElement.dataset.package = pkg;
  }, [pkg]);

  useEffect(() => {
    document.documentElement.dataset.palette = palette;
  }, [palette]);

  const pickPalette = useCallback((id: string) => setPalette(id), []);

  // Digits pick the page colour, L/D pick the package mode. Bubble phase,
  // so the chrome's own digit keys (variant strip up) still win when they
  // answer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e)) return;
      if (/^[0-9]$/.test(e.key)) {
        const index = e.key === "0" ? 9 : Number(e.key) - 1;
        if (index < THEMES.length) setActive(THEMES[index].id);
        return;
      }
      const hit = PACKAGES.find((p) => p.key === e.key.toLowerCase());
      if (hit) setPkg(hit.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Q-P pick the package palette. Capture phase: the chrome claims E as
  // its edits tool in capture on document, so this must run before it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e)) return;
      const hit = PALETTES.find((p) => p.key === e.key.toLowerCase());
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      pickPalette(hit.id);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [pickPalette]);

  return (
    <div className="fixed bottom-[76px] right-6 z-50 flex max-w-[min(92vw,36rem)] flex-col items-end gap-1.5">
      <div
        role="group"
        aria-label="Vartest: landing page colour"
        className="flex max-w-full flex-wrap justify-end gap-1 rounded-2xl border border-neutral-200 bg-neutral-100/90 p-1.5 shadow-layer backdrop-blur-md"
      >
        {THEMES.map((theme, i) => {
          const on = theme.id === active;
          return (
            <button
              key={theme.id}
              type="button"
              aria-pressed={on}
              onClick={() => setActive(theme.id)}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[0.6875rem] font-medium tint ${
                on ? "bg-neutral-900 text-neutral-50" : "text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
              }`}
            >
              <kbd className={`font-mono text-[0.625rem] ${on ? "text-neutral-50/70" : "text-neutral-400"}`}>
                {i === 9 ? "0" : i + 1}
              </kbd>
              {theme.label}
            </button>
          );
        })}
      </div>
      <div
        role="group"
        aria-label="Vartest: package light or dark"
        className="flex max-w-full flex-wrap justify-end gap-1 rounded-2xl border border-neutral-200 bg-neutral-100/90 p-1.5 shadow-layer backdrop-blur-md"
      >
        {PACKAGES.map((p) => {
          const on = p.id === pkg;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => setPkg(p.id)}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[0.6875rem] font-medium tint ${
                on ? "bg-neutral-900 text-neutral-50" : "text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
              }`}
            >
              <kbd className={`font-mono text-[0.625rem] ${on ? "text-neutral-50/70" : "text-neutral-400"}`}>
                {p.key.toUpperCase()}
              </kbd>
              Package {p.label}
            </button>
          );
        })}
      </div>
      <div
        role="group"
        aria-label="Vartest: package colour palette"
        className="flex max-w-full flex-wrap justify-end gap-1 rounded-2xl border border-neutral-200 bg-neutral-100/90 p-1.5 shadow-layer backdrop-blur-md"
      >
        {PALETTES.map((p) => {
          const on = p.id === palette;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              title={`${p.label} palette (${p.key.toUpperCase()})`}
              onClick={() => pickPalette(p.id)}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[0.6875rem] font-medium tint ${
                on ? "bg-neutral-900 text-neutral-50" : "text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
              }`}
            >
              <kbd className={`font-mono text-[0.625rem] ${on ? "text-neutral-50/70" : "text-neutral-400"}`}>
                {p.key.toUpperCase()}
              </kbd>
              <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: p.color }} />
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
