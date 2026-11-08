import type { Metadata } from "next";

// Sample page for the docking trade-off: if the editing toolbar could only
// live in the eight edge places, editing content in the middle of a dense
// page means the bar is always far from the element. Not linked from the site.
export const metadata: Metadata = {
  title: "Sample — Edityy",
  robots: { index: false },
};

const cards = [
  { title: "Checkout", note: "124 orders today", tone: "bg-neutral-900 text-white" },
  { title: "Refunds", note: "9 open requests", tone: "bg-white" },
  { title: "Signups", note: "2,431 this week", tone: "bg-white" },
  { title: "Churn", note: "1.4% last month", tone: "bg-white" },
  { title: "Support", note: "18 tickets waited", tone: "bg-white" },
  { title: "Revenue", note: "$86,120 MTD", tone: "bg-neutral-900 text-white" },
  { title: "Sessions", note: "41,209 visits", tone: "bg-white" },
  { title: "NPS", note: "58 from 900 replies", tone: "bg-white" },
  { title: "Deploy", note: "3 minutes ago", tone: "bg-white" },
];

const rows = [
  ["ADA-1041", "Ada Lim", "Pro plan", "Active"],
  ["MRT-884", "Marta Ruiz", "Team plan", "Paused"],
  ["KJO-552", "Kofi Asante", "Free plan", "Active"],
  ["ZYN-317", "Zineb Haddad", "Pro plan", "Active"],
  ["OPS-619", "Oren Petrov", "Enterprise", "Active"],
  ["SUK-204", "Sana Khoury", "Team plan", "New"],
];

export default function SamplePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-20">
      <section aria-label="Scenario" className="rounded-2xl border border-amber-300 bg-amber-50 px-6 py-5">
        <p className="text-sm font-semibold text-amber-900">Scenario: the toolbar can only live at the 8 edges</p>
        <p className="mt-1 text-sm text-amber-800">
          With free dragging, the bar sits next to whatever you edit. With only 8 places, it stays at the screen
          edges: editing the cards in the middle means the bar is always a screen away. Try it: open edit mode,
          drag the bar to the middle-left, then select a card in the centre.
        </p>
        <ul className="mt-3 list-disc pl-5 text-sm text-amber-800">
          <li>The bar never reaches the centre content: every control is far from the element.</li>
          <li>The edits panel opens away from the element it describes.</li>
          <li>Scrolling is the only way to bring a target near an edge.</li>
        </ul>
      </section>

      <header className="sticky top-0 z-10 -mx-5 border-b border-neutral-200 bg-neutral-50/95 px-5 py-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <p className="font-semibold">Meridian</p>
          <nav className="hidden gap-6 text-sm text-neutral-600 md:flex">
            <span>Overview</span>
            <span>Billing</span>
            <span>Team</span>
            <span>Settings</span>
          </nav>
          <button type="button" className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
            New report
          </button>
        </div>
      </header>

      <section className="py-14">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight">The middle of the page holds most of the work</h1>
        <p className="mt-3 max-w-xl text-neutral-600">
          Headlines, summaries and calls to action live here. When the toolbar is pinned to an edge, every edit to
          these words happens with the controls on the other side of the screen.
        </p>
        <div className="mt-6 flex gap-3">
          <button type="button" className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white">
            Edit the headline
          </button>
          <button
            type="button"
            className="rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-sm font-medium"
          >
            Read the docs
          </button>
        </div>
      </section>

      <section aria-label="Cards" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <article key={card.title} className={`rounded-2xl border border-neutral-200 p-5 ${card.tone}`}>
            <h2 className="text-sm font-medium opacity-70">{card.title}</h2>
            <p className="mt-2 text-2xl font-semibold">{card.note}</p>
            <p className="mt-4 text-sm opacity-70">A target in the centre. The toolbar cannot come here.</p>
          </article>
        ))}
      </section>

      <section aria-label="Table" className="mt-14 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-5 py-4">
          <h2 className="font-semibold">Customers</h2>
          <p className="text-sm text-neutral-600">Rows spread the width of the page; the bar never fits between them.</p>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-500">
              <th className="px-5 py-3 font-medium">ID</th>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Plan</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[0]} className="border-b border-neutral-100 last:border-0">
                {row.map((cell) => (
                  <td key={cell} className="px-5 py-3">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-label="Form" className="mt-14 grid gap-8 rounded-2xl border border-neutral-200 bg-white p-6 md:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold">A small form, field by field</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Each label and input is a separate target. The bar stays at the edge while the caret walks the form.
          </p>
        </div>
        <form className="grid gap-3">
          <label className="grid gap-1 text-sm">
            Company
            <input className="rounded-lg border border-neutral-300 px-3 py-2" defaultValue="Meridian Co" />
          </label>
          <label className="grid gap-1 text-sm">
            Contact email
            <input className="rounded-lg border border-neutral-300 px-3 py-2" defaultValue="hello@meridian.example" />
          </label>
          <label className="grid gap-1 text-sm">
            Region
            <input className="rounded-lg border border-neutral-300 px-3 py-2" defaultValue="EU Central" />
          </label>
          <button type="button" className="mt-1 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
            Save changes
          </button>
        </form>
      </section>

      <footer className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-neutral-200 pt-6 text-sm text-neutral-500">
        <p>Meridian — a sample page for the docking trade-off.</p>
        <p>Footer targets sit at the bottom edge, where the bar can reach them.</p>
      </footer>
    </main>
  );
}
