import type { Metadata } from "next";
import { H1, H2, Lead, Note, P } from "../docs/ui";

export const metadata: Metadata = {
  title: "Design · Edityy",
  description: "The colors of the app, plus warm companions for graphics."
};

type Swatch = {
  name: string;
  hex: string;
  use: string;
  dark?: boolean;
};

function Card({ name, hex, use, dark = false }: Swatch) {
  return (
    <li className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
      <span
        aria-hidden="true"
        className="block h-20 border-b border-neutral-200"
        style={{ backgroundColor: hex }}
      />
      <span className="block p-4">
        <span className="block text-[0.875rem] font-semibold text-neutral-900">{name}</span>
        <span className="mt-0.5 block font-mono text-[0.75rem] text-neutral-500">{hex}</span>
        <span
          className={`mt-2 block text-[0.8125rem] leading-relaxed ${dark ? "text-neutral-600" : "text-neutral-600"}`}
        >
          {use}
        </span>
      </span>
    </li>
  );
}

function Grid({ items }: { items: Swatch[] }) {
  return (
    <ul className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((s) => (
        <Card key={s.name} {...s} />
      ))}
    </ul>
  );
}

const neutrals: Swatch[] = [
  { name: "Paper · neutral-50", hex: "#faf9f6", use: "The canvas. Warm off-white, never pure white." },
  { name: "Surface · neutral-100", hex: "#ffffff", use: "Cards floating over paper." },
  { name: "Hairline · neutral-200", hex: "#e5e2da", use: "Borders and dividers." },
  { name: "Edge · neutral-300", hex: "#d8d3c7", use: "Border under the pointer." },
  { name: "Disabled · neutral-400", hex: "#a8a294", use: "Disabled marks." },
  { name: "Faint · neutral-500", hex: "#777469", use: "Overlines, faint words." },
  { name: "Muted · neutral-600", hex: "#5d5a50", use: "Secondary copy on paper." },
  { name: "Ink hover · neutral-700", hex: "#3a3830", use: "Ink fills under the pointer." },
  { name: "Deep · neutral-800", hex: "#2e2c25", use: "Dark panel step." },
  { name: "Ink · neutral-900", hex: "#25241f", use: "Headlines, body, primary button. Never black." },
];

const brand: Swatch[] = [
  { name: "Brand gold", hex: "#d4a72c", use: "A fill that marks state, with ink on it. Never small text." },
  { name: "Brand ink", hex: "#8a6a10", use: "Gold as readable text: rings, labels, one-pixel rules." },
  { name: "Brand soft", hex: "#fbf3d9", use: "Fill of an open control or a chosen row." },
  { name: "Brand line", hex: "#e9d28b", use: "Hairline of an open control or a chosen row." },
  { name: "Brand hover", hex: "#bd9220", use: "Gold fill under the pointer." },
  { name: "Brand pressed", hex: "#a67e17", use: "Gold fill while pressed." },
];

const status: Swatch[] = [
  { name: "Success", hex: "#217346", use: "Pass states on paper." },
  { name: "Success subtle", hex: "#e9f5ec", use: "Success fill, with success ink on it." },
  { name: "Warning", hex: "#8a5a00", use: "Caution states on paper." },
  { name: "Warning subtle", hex: "#fff3d6", use: "Warning fill, with warning ink on it." },
  { name: "Error", hex: "#c9362b", use: "Fail states on paper." },
  { name: "Error subtle", hex: "#fcebe9", use: "Error fill, with error ink on it." },
];

const graphics: Swatch[] = [
  { name: "Cream", hex: "#f8eed3", use: "Lightest wash. Graphics backgrounds on paper." },
  { name: "Sand", hex: "#eedcae", use: "Deeper wash. Shape fills that sit on paper." },
  { name: "Honey", hex: "#e9c766", use: "Light gold highlight. Same value as the chrome accent." },
  { name: "Marigold", hex: "#dd9423", use: "Saturated amber pop next to brand gold." },
  { name: "Clay", hex: "#c06a35", use: "Warm terracotta. The second voice beside gold." },
  { name: "Rust", hex: "#9a5226", use: "Burnt orange for depth and shadow shapes." },
  { name: "Umber", hex: "#6b4a1f", use: "Dark warm brown. Line work on light grounds." },
  { name: "Espresso", hex: "#453a2c", use: "Soft dark for large graphic shapes. Never pure black." },
  { name: "Sage", hex: "#8b9a7d", use: "Muted green. Fills and foliage next to gold." },
  { name: "Moss", hex: "#5f6e3f", use: "Deep olive. Depth and line work beside the golds." },
  { name: "Slate", hex: "#5d7a8c", use: "Dusty blue. The cool note; keep it small next to warm shapes." },
  { name: "Berry", hex: "#9a4a52", use: "Muted raspberry. The accent when gold is already taken." },
];

const pairs: { name: string; from: string; to: string }[] = [
  { name: "Gold → Clay", from: "#d4a72c", to: "#c06a35" },
  { name: "Honey → Marigold", from: "#e9c766", to: "#dd9423" },
  { name: "Rust → Umber", from: "#9a5226", to: "#6b4a1f" },
  { name: "Sage → Moss", from: "#8b9a7d", to: "#5f6e3f" },
  { name: "Gold → Moss", from: "#d4a72c", to: "#5f6e3f" },
];

const chrome: Swatch[] = [
  { name: "Chrome ink", hex: "#f5f2e9", use: "Words on the dark editor chrome." },
  { name: "Chrome paper", hex: "#22211c", use: "Chrome base. Paper and ink are swapped from the page." },
  { name: "Chrome surface", hex: "#2a2924", use: "Raised chrome surfaces go lighter than paper." },
  { name: "Chrome muted", hex: "#a8a294", use: "Secondary words in the chrome." },
  { name: "Chrome accent", hex: "#e9c766", use: "Keyboard ring and active state on dark." },
  { name: "Chrome accent soft", hex: "#2c2817", use: "Accent fill in the chrome." },
  { name: "Chrome rose", hex: "#6b5a1e", use: "Chrome state mark." },
  { name: "Chrome on-brand", hex: "#1a1915", use: "Words on a gold fill." },
];

export default function DesignPage() {
  return (
    <main className="mx-auto w-full max-w-[58rem] flex-1 px-5 pb-24 pt-16 sm:px-8 sm:pt-20">
      <H1>Design</H1>
      <Lead>
        The colors of the app: warm paper under graphite ink, with one gold doing the
        signalling. Every value below comes from <code>app/globals.css</code>.
      </Lead>

      <Note title="The one rule">
        <p>
          Gold is a fill, never small text: gold on paper is 2.1:1. Words that must read in
          gold use brand ink instead.
        </p>
      </Note>

      <H2>Neutrals</H2>
      <P>Paper → surface → hairline → ink. Every step is warm; a cool grey here is a bug.</P>
      <Grid items={neutrals} />

      <H2>Brand</H2>
      <P>One gold, plus the readable ink and the soft fill and line of a chosen row.</P>
      <Grid items={brand} />

      <H2>Status</H2>
      <P>Each condition is a fill with ink on it, never a thin line of saturated color.</P>
      <Grid items={status} />

      <H2>Editor chrome</H2>
      <P>
        The package chrome is dark, so its paper and ink are swapped from the page. It reads
        these values, never the page ramp, so a landing theme cannot repaint it.
      </P>
      <Grid items={chrome} />

      <H2>For graphics</H2>
      <P>
        Companions to brand gold, for illustrations and site graphics only. Golds and
        warm browns carry the brand; sage, moss, slate and berry are muted seconds that
        stay earthy enough to sit on paper next to gold. Nothing here is a UI token;
        controls keep the ramp above.
      </P>
      <Grid items={graphics} />
      <ul className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
        {pairs.map((p) => (
          <li
            key={p.name}
            className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100"
          >
            <span
              aria-hidden="true"
              className="block h-20 border-b border-neutral-200"
              style={{ backgroundImage: `linear-gradient(120deg, ${p.from}, ${p.to})` }}
            />
            <span className="block p-4">
              <span className="block text-[0.875rem] font-semibold text-neutral-900">{p.name}</span>
              <span className="mt-0.5 block font-mono text-[0.75rem] text-neutral-500">
                {p.from} → {p.to}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
