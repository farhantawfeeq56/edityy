"use client";

import { useState } from "react";

const CARDS = [
  { id: "pricing", name: "Pricing", line: "Three tiers, monthly and yearly." },
  { id: "features", name: "Features", line: "Six things the editor can do." },
  { id: "changelog", name: "Changelog", line: "What shipped this week." },
];

const PLACEHOLDER = "Make all three calm — same padding, one quiet border.";

// A working sketch of the branch behavior: pick several elements, write one
// note, save it once. The save lands on every selected element, the way
// .edityy/changes.json carries it to the agent.
export function CommentDemo() {
  const [selected, setSelected] = useState<string[]>(["pricing", "features"]);
  const [note, setNote] = useState(PLACEHOLDER);
  const [saved, setSaved] = useState<{ note: string; targets: string[] } | null>(null);

  function toggle(id: string, additive: boolean) {
    setSelected((prev) => {
      if (additive) return prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      return prev.includes(id) && prev.length === 1 ? [] : [id];
    });
    setSaved(null);
  }

  function save() {
    const text = note.trim();
    if (!text || selected.length === 0) return;
    setSaved({ note: text, targets: [...selected] });
  }

  const ready = note.trim().length > 0 && selected.length > 0;

  return (
    <div className="layer overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-4 py-3 sm:px-5">
        <span className="rounded-full bg-neutral-900 px-2.5 py-1 font-mono text-[0.625rem] uppercase tracking-[0.1em] text-neutral-50">
          {selected.length} selected
        </span>
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.1em] text-neutral-500">
          click selects · Shift-click adds
        </span>
        <span className="ml-auto flex gap-1.5">
          <button
            type="button"
            onClick={() => {
              setSelected(CARDS.map((c) => c.id));
              setSaved(null);
            }}
            className="rounded-lg px-2.5 py-1.5 text-[0.75rem] font-medium text-neutral-600 tint hover:bg-blush hover:text-neutral-900"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => {
              setSelected([]);
              setSaved(null);
            }}
            className="rounded-lg px-2.5 py-1.5 text-[0.75rem] font-medium text-neutral-600 tint hover:bg-blush hover:text-neutral-900"
          >
            Clear
          </button>
        </span>
      </div>

      <div className="grid gap-2.5 p-4 sm:grid-cols-3 sm:p-5">
        {CARDS.map((card) => {
          const on = selected.includes(card.id);
          return (
            <button
              key={card.id}
              type="button"
              aria-pressed={on}
              onClick={(e) => toggle(card.id, e.shiftKey)}
              className={`rounded-xl border p-3.5 text-left tint ${
                on
                  ? "border-brand-ink bg-brand-soft shadow-layer"
                  : "border-neutral-200 bg-neutral-100 hover:border-neutral-300"
              }`}
            >
              <span className="flex items-center justify-between">
                <span className="text-[0.875rem] font-semibold tracking-[-0.01em]">{card.name}</span>
                <span
                  aria-hidden="true"
                  className={`flex size-4 items-center justify-center rounded-full border text-[0.625rem] ${
                    on ? "border-brand-ink bg-neutral-900 text-neutral-50" : "border-neutral-300 text-transparent"
                  }`}
                >
                  ✓
                </span>
              </span>
              <span className="mt-1 block text-[0.8125rem] leading-relaxed text-neutral-600">{card.line}</span>
              <span className="mt-2.5 block h-1.5 w-full rounded-full bg-neutral-200" />
              <span className="mt-1 block h-1.5 w-3/4 rounded-full bg-neutral-200" />
              {saved && saved.targets.includes(card.id) ? (
                <span className="mt-2.5 block rounded-lg bg-neutral-900 px-2.5 py-1.5 text-[0.75rem] leading-snug text-neutral-50">
                  “{saved.note}”
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="border-t border-neutral-200 bg-neutral-100 px-4 py-4 sm:px-5">
        <label htmlFor="demo-note" className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-neutral-500">
          One note for the set
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="demo-note"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setSaved(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            placeholder={PLACEHOLDER}
            className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-[0.875rem] text-neutral-900 outline-none tint placeholder:text-neutral-400 focus:border-brand-ink"
          />
          <button
            type="button"
            onClick={save}
            disabled={!ready}
            className="rounded-lg bg-neutral-900 px-5 py-2.5 text-[0.875rem] font-medium text-neutral-50 tint hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save note
          </button>
        </div>
        <p aria-live="polite" className="mt-2.5 font-mono text-[0.6875rem] text-neutral-500">
          {saved
            ? `Saved — the same note sits on ${saved.targets.length} element${saved.targets.length === 1 ? "" : "s"}: ${saved.targets.join(", ")}.`
            : selected.length === 0
              ? "Select at least one card, then save."
              : "Save writes the note onto every selected card above."}
        </p>
      </div>
    </div>
  );
}
