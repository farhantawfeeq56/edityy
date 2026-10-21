// The structure of the docs. One list drives the sidebar, so a new page is
// added in one place. Every page here has content in the package behind it.
export const nav: { title: string; pages: { href: string; title: string }[] }[] = [
  {
    title: "Start",
    pages: [
      { href: "/docs", title: "Overview" },
      { href: "/docs/install", title: "Install" },
    ],
  },
  {
    title: "Use",
    pages: [
      { href: "/docs/editing", title: "The editing mode" },
      { href: "/docs/variations", title: "Style variations" },
      { href: "/docs/handoff", title: "Hand-off" },
    ],
  },
  {
    title: "Connect",
    pages: [
      { href: "/docs/mcp", title: "The MCP server" },
      { href: "/docs/api", title: "API" },
    ],
  },
];
