import type { Metadata } from "next";
import { PuckEditor, TiptapEditor } from "./editors";

// Throwaway page for comparing editor stacks (#11). Not linked from the site.
export const metadata: Metadata = {
  title: "Playground — Edityy",
  robots: { index: false },
};

export default function Playground() {
  return (
    <main className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[3fr_1fr]">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Puck</h2>
        <div className="h-[80vh] overflow-hidden border border-neutral-300">
          <PuckEditor />
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Tiptap</h2>
        <TiptapEditor />
      </section>
    </main>
  );
}
