"use client";

import { useState } from "react";

// Vartest: the toolbar's three tools (Comment / Add / Edits) in four MIT
// icon libraries that ship a true filled state, plus the current Lucide set
// for reference. Each row is a working mini-toolbar: click a tool to make
// it the selected one. The selected icon is the library's own filled glyph
// on the hover colour (--ink-6), the way the toolbar behaves when a tool is
// on. The unselected icons are the library's outline glyphs.

type Icon = { name: string; svg: string };

const LUCIDE: Icon[] = [
  {
    name: "Comment",
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" /></svg>',
  },
  {
    name: "Add",
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M8 12h8" /><path d="M12 8v8" /></svg>',
  },
  {
    name: "Edits",
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M7 8h10" /><path d="M7 12h10" /><path d="M7 16h6" /></svg>',
  },
];

const TABLER_OUTLINE: Icon[] = [
  {
    name: "Comment",
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a7 7 0 0 0 -7 7c0 3.243 2.209 5.987 5 6.82v4.18c.473 .616 1.265 1 2 1s1.527 -.384 2 -1v-4.18c2.791 -.833 5 -3.577 5 -6.82a7 7 0 0 0 -7 -7z" /></svg>',
  },
  {
    name: "Add",
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h-6a3 3 0 0 0 -3 3v12a3 3 0 0 0 3 3h6a3 3 0 0 0 3 -3v-12a3 3 0 0 0 -3 -3z" /><path d="M9 9h6" /><path d="M12 6v6" /></svg>',
  },
  {
    name: "Edits",
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3h-7a2 2 0 0 0 -2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" /><path d="M14 3v4a2 2 0 0 0 2 2h4" /><path d="M10 13l-1 1 1 1" /><path d="M14 17l1 1-1 1" /></svg>',
  },
];

const TABLER_FILLED: Icon[] = [
  {
    name: "Comment",
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.821 4.91c3.899 -2.765 9.468 -2.539 13.073 .535c3.667 3.129 4.168 8.238 1.152 11.898c-2.841 3.447 -7.965 4.583 -12.231 2.805l-.233 -.101l-4.374 .931l-.04 .006l-.035 .007h-.018l-.022 .005h-.038l-.033 .004l-.021 -.001l-.023 .001l-.033 -.003h-.035l-.022 -.004l-.022 -.002l-.035 -.007l-.034 -.005l-.016 -.004l-.024 -.005l-.049 -.016l-.024 -.005l-.011 -.005l-.022 -.007l-.045 -.02l-.03 -.012l-.011 -.006l-.014 -.006l-.031 -.018l-.045 -.024l-.016 -.011l-.037 -.026l-.04 -.027l-.002 -.004l-.013 -.009l-.043 -.04l-.025 -.02l-.006 -.007l-.056 -.062l-.013 -.014l-.011 -.014l-.039 -.056l-.014 -.019l-.005 -.01l-.042 -.073l-.007 -.012l-.004 -.008l-.007 -.012l-.014 -.038l-.02 -.042l-.004 -.016l-.004 -.01l-.017 -.061l-.007 -.018l-.002 -.015l-.005 -.019l-.005 -.033l-.008 -.042l-.002 -.031l-.003 -.01v-.016l-.004 -.054l.001 -.036l.001 -.023l.002 -.053l.004 -.025v-.019l.008 -.035l.005 -.034l.005 -.02l.004 -.02l.018 -.06l.003 -.013l1.15 -3.45l-.022 -.037c-2.21 -3.747 -1.209 -8.391 2.413 -11.119z" /></svg>',
  },
  {
    name: "Add",
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l.324 .001l.318 .004l.616 .017l.299 .013l.579 .034l.553 .046c4.785 .464 6.732 2.411 7.196 7.196l.046 .553l.034 .579c.005 .098 .01 .198 .013 .299l.017 .616l.005 .642l-.005 .642l-.017 .616l-.013 .299l-.034 .579l-.046 .553c-.464 4.785 -2.411 6.732 -7.196 7.196l-.553 .046l-.579 .034c-.098 .005 -.198 .01 -.299 .013l-.616 .017l-.642 .005l-.642 -.005l-.616 -.017l-.299 -.013l-.579 -.034l-.553 -.046c-4.785 -.464 -6.732 -2.411 -7.196 -7.196l-.046 -.553l-.034 -.579a28.058 28.058 0 0 1 -.013 -.299l-.017 -.616c-.003 -.21 -.005 -.424 -.005 -.642l.001 -.324l.004 -.318l.017 -.616l.013 -.299l.034 -.579l.046 -.553c.464 -4.785 2.411 -6.732 7.196 -7.196l.553 -.046l.579 -.034c.098 -.005 .198 -.01 .299 -.013l.616 -.017c.21 -.003 .424 -.005 .642 -.005zm0 6a1 1 0 0 0 -1 1v2h-2l-.117 .007a1 1 0 0 0 .117 1.993h2v2l.007 .117a1 1 0 0 0 1.993 -.117v-2h2l.117 -.007a1 1 0 0 0 -.117 -1.993h-2v-2l-.007 -.117a1 1 0 0 0 -.993 -.883z" fill="currentColor" /></svg>',
  },
  {
    name: "Edits",
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l.117 .007a1 1 0 0 1 .876 .876l.007 .117v4l.005 .15a2 2 0 0 0 1.838 1.844l.157 .006h4l.117 .007a1 1 0 0 1 .876 .876l.007 .117v9a3 3 0 0 1 -2.824 2.995l-.176 .005h-10a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-14a3 3 0 0 1 2.824 -2.995l.176 -.005zm3 14h-6a1 1 0 0 0 0 2h6a1 1 0 0 0 0 -2m0 -4h-6a1 1 0 0 0 0 2h6a1 1 0 0 0 0 -2" /><path d="M19 7h-4l-.001 -4.001z" /></svg>',
  },
];

const PHOSPHOR_REGULAR: Icon[] = [
  {
    name: "Comment",
    svg: '<svg viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="16"><path d="M232,128A104,104,0,0,1,79.12,219.82L45.07,231.17a16,16,0,0,1-20.24-20.24l11.35-34.05A104,104,0,1,1,232,128Z" /></svg>',
  },
  {
    name: "Add",
    svg: '<svg viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="16"><path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM168,136H136v32a8,8,0,0,1-16,0V136H88a8,8,0,0,1,0-16h32V88a8,8,0,0,1,16,0v32h32a8,8,0,0,1,0,16Z" /></svg>',
  },
  {
    name: "Edits",
    svg: '<svg viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="16"><path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,176H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Zm0-32H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Zm-8-56V44l44,44Z" /></svg>',
  },
];

const PHOSPHOR_FILL: Icon[] = [
  {
    name: "Comment",
    svg: '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M232,128A104,104,0,0,1,79.12,219.82L45.07,231.17a16,16,0,0,1-20.24-20.24l11.35-34.05A104,104,0,1,1,232,128Z"/></svg>',
  },
  {
    name: "Add",
    svg: '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM168,136H136v32a8,8,0,0,1-16,0V136H88a8,8,0,0,1,0-16h32V88a8,8,0,0,1,16,0v32h32a8,8,0,0,1,0,16Z"/></svg>',
  },
  {
    name: "Edits",
    svg: '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,176H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Zm0-32H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Zm-8-56V44l44,44Z"/></svg>',
  },
];

const HERO_OUTLINE: Icon[] = [
  {
    name: "Comment",
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z" /></svg>',
  },
  {
    name: "Add",
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.5v15m7.5-7.5h-15" /></svg>',
  },
  {
    name: "Edits",
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>',
  },
];

const HERO_SOLID: Icon[] = [
  {
    name: "Comment",
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M12 2.25c-2.429 0-4.817.178-7.152.521C2.87 3.061 1.5 4.795 1.5 6.741v6.018c0 1.946 1.37 3.68 3.348 3.97.877.129 1.761.234 2.652.316V21a.75.75 0 0 0 1.28.53l4.184-4.183a.39.39 0 0 1 .266-.112c2.006-.05 3.982-.22 5.922-.506 1.978-.29 3.348-2.023 3.348-3.97V6.741c0-1.947-1.37-3.68-3.348-3.97A49.145 49.145 0 0 0 12 2.25ZM8.25 8.625a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Zm2.625 1.125a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875-1.125a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Z" clip-rule="evenodd"/></svg>',
  },
  {
    name: "Add",
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd"/></svg>',
  },
  {
    name: "Edits",
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0 0 16.5 9h-1.875a1.875 1.875 0 0 1-1.875-1.875V5.25A3.75 3.75 0 0 0 9 1.5H5.625ZM7.5 15a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 15Zm.75 2.25a.75.75 0 0 0 0 1.5H12a.75.75 0 0 0 0-1.5H8.25Z" clip-rule="evenodd"/><path d="M12.971 1.816A5.23 5.23 0 0 1 14.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 0 1 3.434 1.279 9.768 9.768 0 0 0-6.963-6.963Z"/></svg>',
  },
];

const BOOTSTRAP_OUTLINE: Icon[] = [
  {
    name: "Comment",
    svg: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1"><path d="M2.5 2h11a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5H3a2 2 0 0 0-2 2V2.5a.5.5 0 0 1 .5-.5Z" /></svg>',
  },
  {
    name: "Add",
    svg: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1"><path d="M2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2zM8 4.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3H4a.5.5 0 0 1 0-1h3v-3a.5.5 0 0 1 1 0Z" /></svg>',
  },
  {
    name: "Edits",
    svg: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1"><path d="M12 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2zM5 4h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1zm-.5 2.5A.5.5 0 0 1 5 6h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1-.5-.5M5 8h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1z" /></svg>',
  },
];

const BOOTSTRAP_FILLED: Icon[] = [
  {
    name: "Comment",
    svg: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 15c4.418 0 8-3.134 8-7s-3.582-7-8-7-8 3.134-8 7c0 1.76.743 3.37 1.97 4.6-.097 1.016-.417 2.13-.771 2.966-.079.186.074.394.273.362 2.256-.37 3.597-.938 4.18-1.234A9 9 0 0 0 8 15"/></svg>',
  },
  {
    name: "Add",
    svg: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2zm6.5 4.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3a.5.5 0 0 1 1 0"/></svg>',
  },
  {
    name: "Edits",
    svg: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M12 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2M5 4h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1m-.5 2.5A.5.5 0 0 1 5 6h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1-.5-.5M5 8h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1m0 2h3a.5.5 0 0 1 0 1H5a.5.5 0 0 1 0-1"/></svg>',
  },
];

type Variant = {
  label: string;
  license: string;
  note: string;
  outline: Icon[];
  filled: Icon[];
  size: number;
};

const VARIANTS: Variant[] = [
  {
    label: "1 · Tabler",
    license: "MIT",
    note: "Filled glyphs are their own drawings, not CSS-filled outlines. Closest silhouette match to Lucide.",
    outline: TABLER_OUTLINE,
    filled: TABLER_FILLED,
    size: 24,
  },
  {
    label: "2 · Phosphor",
    license: "MIT",
    note: "One icon, four weights; fill is a real filled weight on the same grid as regular.",
    outline: PHOSPHOR_REGULAR,
    filled: PHOSPHOR_FILL,
    size: 24,
  },
  {
    label: "3 · Heroicons",
    license: "MIT",
    note: "Solid style alongside outline. Chunkier, rounder corners than Lucide.",
    outline: HERO_OUTLINE,
    filled: HERO_SOLID,
    size: 24,
  },
  {
    label: "4 · Bootstrap Icons",
    license: "MIT",
    note: "16px grid, filled suffix twins. Compact and dense at 16px.",
    outline: BOOTSTRAP_OUTLINE,
    filled: BOOTSTRAP_FILLED,
    size: 16,
  },
];

const INK_6 = "color-mix(in srgb, #25241f 6%, transparent)";
const INK = "#25241f";
const MUTED = "#5d5a50";

function Toolbar({ variant, active, setActive }: { variant: Variant; active: number; setActive: (i: number) => void }) {
  return (
    <div
      className="row"
      style={{
        position: "relative",
        display: "inline-flex",
        gap: 2,
        padding: 3,
        borderRadius: 10,
        background: "#ffffff",
        boxShadow: "0 0 0 1px color-mix(in srgb, #25241f 10%, transparent), 0 1px 2px color-mix(in srgb, #25241f 6%, transparent), 0 6px 16px color-mix(in srgb, #25241f 8%, transparent)",
      }}
    >
      {variant.outline.map((icon, i) => {
        const on = active === i;
        return (
          <button
            key={icon.name}
            type="button"
            aria-label={icon.name}
            aria-pressed={on}
            title={icon.name + (on ? " (on)" : "")}
            onClick={() => setActive(on ? -1 : i)}
            style={{
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              border: "1px solid transparent",
              borderRadius: 7,
              background: on ? INK_6 : "transparent",
              color: on ? INK : MUTED,
              cursor: "pointer",
              padding: 0,
            }}
          >
            <span
              aria-hidden="true"
              style={{ width: 16, height: 16, display: "block", color: "inherit" }}
              dangerouslySetInnerHTML={{ __html: (on ? variant.filled[i] : variant.outline[i]).svg }}
            />
          </button>
        );
      })}
    </div>
  );
}

export default function VartestPage() {
  const [active, setActive] = useState<number[]>(VARIANTS.map(() => 0));
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px 96px", fontFamily: "system-ui, sans-serif", color: INK }}>
      <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>Toolbar icon vartest</h1>
      <p style={{ color: MUTED, margin: "0 0 40px", lineHeight: 1.5, maxWidth: 560 }}>
        Four MIT-licensed icon libraries with a true filled state, drawn inside the toolbar&rsquo;s three tools
        (Comment / Add / Edits). Click a tool in any row to move the selected state: the selected icon turns
        into that library&rsquo;s filled glyph on the hover colour, the rest stay outline.
      </p>
      <section style={{ display: "flex", flexDirection: "column", gap: 36 }}>
        {VARIANTS.map((v, vi) => (
          <article key={v.label}>
            <header style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>{v.label}</h2>
              <span style={{ fontSize: 12, color: MUTED }}>{v.license}</span>
            </header>
            <p style={{ fontSize: 13, color: MUTED, margin: "0 0 12px", maxWidth: 560 }}>{v.note}</p>
            <Toolbar
              variant={v}
              active={active[vi]}
              setActive={(i) =>
                setActive((prev) => {
                  const next = [...prev];
                  next[vi] = i;
                  return next;
                })
              }
            />
            <p style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>Selected glyphs: {v.filled.map((i) => i.name).join(", ")}</p>
          </article>
        ))}
        <article>
          <header style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>Current · Lucide</h2>
            <span style={{ fontSize: 12, color: MUTED }}>ISC · outline only</span>
          </header>
          <p style={{ fontSize: 13, color: MUTED, margin: "0 0 12px", maxWidth: 560 }}>
            What the toolbar wears today. No filled twin exists, so the selected state can only change the
            background.
          </p>
          <div
            style={{
              position: "relative",
              display: "inline-flex",
              gap: 2,
              padding: 3,
              borderRadius: 10,
              background: "#ffffff",
              boxShadow: "0 0 0 1px color-mix(in srgb, #25241f 10%, transparent), 0 1px 2px color-mix(in srgb, #25241f 6%, transparent), 0 6px 16px color-mix(in srgb, #25241f 8%, transparent)",
            }}
          >
            {LUCIDE.map((icon, i) => (
              <span
                key={icon.name}
                aria-hidden="true"
                title={icon.name}
                style={{
                  width: 32,
                  height: 32,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 7,
                  background: i === 0 ? INK_6 : "transparent",
                  color: i === 0 ? INK : MUTED,
                }}
              >
                <span style={{ width: 16, height: 16, display: "block", color: "inherit" }} dangerouslySetInnerHTML={{ __html: icon.svg }} />
              </span>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
