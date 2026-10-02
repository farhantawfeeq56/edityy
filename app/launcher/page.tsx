import { headers } from "next/headers";
import { Card } from "@/app/ui";
import { LocalLauncher } from "./local-launcher";

export const metadata = { title: "Local launcher — Edityy" };

export default async function LauncherPage() {
  // Edityy might not be on :3000 — the developer's own site usually is, and
  // `next dev -p 3001` is the documented workaround. Read the real host so the
  // tag we print is the one that actually resolves.
  const host = (await headers()).get("host") ?? "localhost:3000";

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
          stack. No npm package, no build step, no change to your code beyond this line.
        </p>
        <pre className="overflow-x-auto rounded-md border border-neutral-200 bg-neutral-100 p-3 font-mono text-xs">
          {`<script src="http://${host}/edityy.js" defer></script>`}
        </pre>
        {host !== "localhost:3000" && (
          <p className="mt-2 text-sm text-neutral-500">
            Edityy is running on <span className="font-medium text-neutral-900">{host}</span>, so the tag above points
            there.
          </p>
        )}
      </Card>
      <Card title="2. Open your site and look at the bottom-right">
        <LocalLauncher />
      </Card>
    </main>
  );
}