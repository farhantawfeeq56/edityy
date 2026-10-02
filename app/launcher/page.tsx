import { Card } from "@/app/ui";
import { LocalLauncher } from "./local-launcher";

export const metadata = { title: "Local launcher — Edityy" };

/** The one line a developer puts in their own project. */
const TAG = `<script src="http://localhost:3000/edityy.js" defer></script>`;

export default function LauncherPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Local launcher</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Add one script tag to any site running on your machine. Edityy places its launcher in the bottom-right corner
          of that site, on top of the real page.
        </p>
      </header>
      <Card title="1. Add one tag to your site">
        <p className="mb-3 text-sm text-neutral-500">
          Put it in your site&apos;s <code className="font-mono text-xs">index.html</code>, layout or template — any
          stack. No npm package, no build step, no change to your code beyond this line. Edityy serves the script from
          your own machine.
        </p>
        <pre className="overflow-x-auto rounded-md border border-neutral-200 bg-neutral-100 p-3 font-mono text-xs">
          {TAG}
        </pre>
      </Card>
      <Card title="2. Open your site and look at the bottom-right">
        <LocalLauncher />
      </Card>
    </main>
  );
}
