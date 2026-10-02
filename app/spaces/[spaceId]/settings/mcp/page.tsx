export default function McpSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">MCP</h1>
        <p className="mt-1 text-sm text-neutral-500">
          The Model Context Protocol server lets an AI coding agent read a space&rsquo;s components and write the
          change set back into the codebase.
        </p>
      </header>

      <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-10 text-center">
        <p className="text-sm font-medium">MCP is not built yet.</p>
        <p className="mt-2 text-sm text-neutral-500">
          Until then, hand the change set to your agent by hand &mdash; the codebase stays the source of truth
          either way.
        </p>
      </div>
    </div>
  );
}