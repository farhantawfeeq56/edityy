import type { Metadata } from "next";
import { H1, H2, Lead, Note, P } from "../docs/ui";

export const metadata: Metadata = {
  title: "Design · Edityy",
  description: "The colors of the app: warm paper, graphite ink, one gold.",
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
    </main>
  );
}
