import Link from "next/link";

export default function SettingsLayout(props: LayoutProps<"/spaces/[spaceId]/settings">) {
  return (
    <div className="flex flex-col gap-6">
      <nav className="flex flex-wrap gap-1 self-start rounded-[28px] border border-neutral-200 bg-neutral-100 p-1 text-sm">
        <Tab href=".">Space</Tab>
        <Tab href="codebase">Codebase connection</Tab>
        <Tab href="mcp">MCP</Tab>
        <Tab href="/settings/account">Account</Tab>
      </nav>
      {props.children}
    </div>
  );
}

function Tab({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="rounded-[28px] px-3 py-1.5 text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-900" href={href}>
      {children}
    </Link>
  );
}