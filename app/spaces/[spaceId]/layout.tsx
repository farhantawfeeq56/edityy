import Link from "next/link";

export default function SpaceLayout(props: LayoutProps<"/spaces/[spaceId]">) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-6">
      <nav className="flex items-center gap-4 border-b border-neutral-200 pb-3 text-sm">
        <Link className="font-semibold tracking-tight" href="/spaces">
          Edityy
        </Link>
        <span aria-hidden className="text-neutral-300">/</span>
        <Tab href=".">Overview</Tab>
        <Tab href="editor">Editor</Tab>
        <Tab href="components">Components</Tab>
        <Tab href="settings">Settings</Tab>
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