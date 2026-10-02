import { Pending } from "@/app/ui";

export default function McpSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1>MCP</h1>
        <p className="mt-1 text-sm text-neutral-500">
          The Model Context Protocol server lets an AI coding agent read a space&rsquo;s components and write the
          change set back into the codebase.
        </p>
      </header>

      <Pending title="MCP is not built yet.">
        Until then, hand the change set to your agent by hand &mdash; the codebase stays the source of truth
        either way.
      </Pending>
    </div>
  );
}