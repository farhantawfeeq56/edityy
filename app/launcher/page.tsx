import { Card } from "@/app/ui";
import { LocalLauncher } from "./local-launcher";

export const metadata = { title: "Local launcher — Edityy" };

export default function LauncherPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Local launcher</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Point Edityy at a website you are already running. Edityy proxies that page and places its launcher on top
          of it. Nothing is installed in your project.
        </p>
      </header>
      <Card title="Connect">
        <LocalLauncher />
      </Card>
    </main>
  );
}
