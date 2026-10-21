import { H1, Lead, P, H2, UL, LI, Code, Pre } from "../ui";

export const metadata = {
  title: "API — Edityy Docs",
  description: "The middleware options, the exports, the events and the known limits.",
};

export default function DocsApi() {
  return (
    <>
      <H1>API</H1>
      <Lead>Everything the package exports, and everything it does that can surprise you.</Lead>

      <H2 id="middleware">The middleware</H2>
      <Pre>{`edityy({ tag, nonce, root, save, allowedHosts }) // returns a (req, res, next) middleware`}</Pre>
      <UL>
        <LI>
          <Code>tag</Code> defaults to <Code>{'&lt;script src="/__edityy/edityy.js" defer&gt;&lt;/script&gt;'}</Code>. Pass
          your own if you need a different attribute set.
        </LI>
        <LI>
          <Code>nonce</Code> adds a nonce to the tag, for a page with a strict <Code>script-src</Code> CSP. Give a
          string, or a function <Code>(req, res) =&gt; string</Code> when your app makes a new nonce for each response.
        </LI>
        <LI>
          <Code>root</Code> is where <Code>.edityy/changes.json</Code> is written. It defaults to{" "}
          <Code>process.cwd()</Code>.
        </LI>
        <LI>
          <Code>save: false</Code> turns off the save endpoint and the variation endpoint.
        </LI>
        <LI>
          <Code>allowedHosts</Code> names more hosts the save endpoint takes, besides <Code>localhost</Code> and IP
          addresses. A leading dot also takes the subdomains. <Code>true</Code> takes every host.
        </LI>
      </UL>
      <P>
        The Vite plugin takes the same options, and adds one of its own: <Code>source: false</Code> turns off the{" "}
        <Code>data-edityy-src</Code> attribute.
      </P>

      <H2 id="exports">The exports</H2>
      <UL>
        <LI>
          <Code>launcher</Code> is the launcher script, as a string.
        </LI>
        <LI>
          <Code>ASSET_PATH</Code> is <Code>/__edityy/edityy.js</Code>, and <Code>TAG</Code> is the default script tag.
        </LI>
        <LI>
          <Code>inject(body, tag?)</Code> injects the tag into an HTML string yourself.
        </LI>
        <LI>
          <Code>{"changesRoute({ root, allowedHosts })"}</Code> is the save endpoint as a fetch-style route handler.
        </LI>
        <LI>
          <Code>{"variationsRoute({ root, allowedHosts })"}</Code> is the variation endpoint as <Code>GET</Code>,{" "}
          <Code>POST</Code> and <Code>DELETE</Code> route handlers.
        </LI>
        <LI>
          <Code>writeChanges(payload, root?)</Code> writes the changes file yourself.
        </LI>
        <LI>
          <Code>CHANGES_PATH</Code> and <Code>CHANGES_FILE</Code> are the endpoint path and the file name.
        </LI>
        <LI>
          <Code>edityy/client</Code> is the browser bootstrap that mounts the launcher, for frameworks that inject
          client modules.
        </LI>
        <LI>
          <Code>edityy/inject</Code> is the main module under a second name, for frameworks that render the script tag
          themselves.
        </LI>
        <LI>
          <Code>edityy/vite</Code> is the Vite plugin.
        </LI>
      </UL>

      <H2 id="events">The events</H2>
      <P>
        <Code>edityy:launcher-click</Code> is dispatched on <Code>window</Code> each time the launcher is clicked, for
        a host app that wants to know.
      </P>

      <H2 id="limits">The known limits</H2>
      <UL>
        <LI>
          <strong>Dev-only.</strong> This is not a proxy and not a production server plugin. Install it as a dev
          dependency and keep it out of your production build.
        </LI>
        <LI>
          <strong>Streamed HTML is held only up to <Code>&lt;/head&gt;</Code>.</strong> A chunked response gets the tag
          before <Code>&lt;/head&gt;</Code>, and everything after it streams through. If no <Code>&lt;/head&gt;</Code>{" "}
          arrives in the first 256 KB, the page is sent unchanged.
        </LI>
        <LI>
          <strong>A strict <Code>script-src</Code> CSP blocks the tag</strong> unless you pass the page&apos;s nonce as{" "}
          <Code>nonce</Code>.
        </LI>
        <LI>
          <strong>Google Fonts need network access.</strong> A page whose CSP blocks <Code>api.fontsource.org</Code>,{" "}
          <Code>fonts.googleapis.com</Code> or <Code>fonts.gstatic.com</Code> shows only its own fonts.
        </LI>
        <LI>
          <strong>It fails open.</strong> An error inside the middleware is swallowed, and your page is served
          unchanged, rather than taking the dev server down.
        </LI>
      </UL>

      <H2 id="cli">The command</H2>
      <Pre file="terminal">{`edityy mcp [--root <dir>]`}</Pre>
      <P>
        The command has one subcommand. <Code>mcp</Code> serves the saved edits to a coding agent over MCP, on stdio.
      </P>
    </>
  );
}
