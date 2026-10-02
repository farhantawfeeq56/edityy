import Link from "next/link";

export default function SettingsLayout(props: LayoutProps<"/spaces/[spaceId]/settings">) {
  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-4 border-b border-neutral-200 pb-3 text-sm">
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
    <Link className="text-neutral-500 hover:text-neutral-900" href={href}>
      {children}
    </Link>
  );
}