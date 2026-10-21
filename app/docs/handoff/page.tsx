import { H1, Lead, P, H2, H3, UL, LI, Code, Pre, Note } from "../ui";

export const metadata = {
  title: "Hand-off — Edityy Docs",
  description: "Copy the edits, or save them to your project.",
};

export default function DocsHandoff() {
  return (
    <>
      <H1>Hand-off</H1>
      <Lead>
        Edityy does not write to your source code. It writes down what you changed, and your agent makes the change in
        the file, in the way your project already styles things.
      </Lead>

      <H2 id="copy">Copy for an agent</H2>
      <P>
        The edits button in the dock lists every element that really changed. Select an element, or press the copy
        button, and the edits come out as Markdown.
      </P>
      <Pre>{`# Visual edits from Edityy

Apply these edits to the source code. Change the code
that renders each element, in the styling approach
the project already uses.

## 1. Heading
- Selector: \`h1.hero-title\`
- Source: \`src/App.tsx:12:7\`
- \`font-size\`: \`44px\` → \`52px\`
- \`color\`: \`#16233a\` → \`#2f5fa8\``}</Pre>
      <P>
        Each edit names its selector, its source line when the plugin knows it, and every value before and after. A
        comment you wrote about the element travels with it.
      </P>

      <H2 id="save">Save to project</H2>
      <P>
        <strong>Save to project</strong> sends the edits to the dev server, which writes them to{" "}
        <Code>.edityy/changes.json</Code> in your project root. The folder gets its own <Code>.gitignore</Code>, so
        pending edits never end up in a commit.
      </P>
      <Pre file=".edityy/changes.json">{`{
  "version": 1,
  "savedAt": "2026-10-06T09:30:00.000Z",
  "page": "http://localhost:5173/pricing",
  "markdown": "# Visual edits from Edityy\\n…",
  "changes": [
    {
      "label": "h1 “Simple pricing”",
      "selector": "#pricing > h1",
      "source": "src/Pricing.tsx:12:7",
      "props": [{ "prop": "font-size", "before": "32px", "after": "40px" }],
      "text": { "before": "Simple pricing", "after": "Pricing" }
    }
  ]
}`}</Pre>

      <H3>The endpoint</H3>
      <P>
        The Vite plugin and the middleware handle this themselves, on <Code>POST /__edityy/changes</Code>. The
        middleware writes under <Code>process.cwd()</Code>, and the Vite plugin under Vite’s <Code>root</Code>, or
        under <Code>root</Code> if you pass one. Both accept only JSON from the page’s own origin.
      </P>
      <P>
        Each change is checked before it is written, and the <Code>markdown</Code> field is made from the checked
        changes. The page cannot put its own text there.
      </P>
      <P>
        <Code>save: false</Code> turns the endpoint off. It also turns off the variation endpoint.
      </P>

      <H3>Hosts</H3>
      <P>
        The endpoint takes requests only for <Code>localhost</Code>, its subdomains, and IP addresses. This stops
        another site that points its own name at your computer.
      </P>
      <P>If you open the dev server under another name, add it.</P>
      <Pre>{`edityy({ allowedHosts: ["dev.example", ".test.example"] })`}</Pre>
      <UL>
        <LI>A leading dot takes the subdomains too.</LI>
        <LI>
          <Code>true</Code> takes every host.
        </LI>
      </UL>

      <H3>Next.js</H3>
      <P>Next.js needs one route file and one rewrite.</P>
      <Pre file="app/edityy/changes/route.ts">{`import { changesRoute } from "edityy";

export const POST = changesRoute();`}</Pre>
      <Pre file="next.config.ts">{`async rewrites() {
  return [{ source: "/__edityy/changes", destination: "/edityy/changes" }];
}`}</Pre>
      <Note title="The route is development only">
        The route answers 404 unless <Code>NODE_ENV</Code> is <Code>development</Code>, so it writes nothing in a
        production build.
      </Note>
    </>
  );
}
