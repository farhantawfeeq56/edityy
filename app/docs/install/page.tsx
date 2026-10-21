import { H1, Lead, P, H2, H3, UL, LI, Code, Pre, Note } from "../ui";

export const metadata = {
  title: "Install — Edityy Docs",
  description: "Install Edityy on Vite, Connect, Express, or Next.js.",
};

export default function DocsInstall() {
  return (
    <>
      <H1>Install</H1>
      <Lead>
        Edityy is a dev dependency. It runs on your dev server only, and it never ships in a production build.
      </Lead>

      <Pre file="terminal">{`npm install -D edityy`}</Pre>

      <P>Add one line to your dev server. The middleware serves the launcher and injects the tag into the HTML that
        server returns.</P>

      <H2 id="vite">Vite</H2>
      <Pre file="vite.config.ts">{`import { defineConfig } from "vite";
import { edityy } from "edityy/vite";

export default defineConfig({
  plugins: [edityy()],
});`}</Pre>
      <P>
        The plugin runs on the dev server only, so <Code>vite build</Code> never includes the launcher. It works for
        every framework that runs on a Vite dev server: React, Vue, Svelte, Solid, SvelteKit, Astro, Nuxt, Remix and
        React Router.
      </P>
      <H3>Source locations</H3>
      <P>
        On Vite 8 or later the plugin also marks where each element was written. Every DOM element in a{" "}
        <Code>.jsx</Code> or <Code>.tsx</Code> file gets a <Code>data-edityy-src</Code> attribute, so an edit can
        name the exact line to change.
      </P>
      <UL>
        <LI>Components are skipped. A component can drop the attribute.</LI>
        <LI>
          Turn the attribute off with <Code>edityy({"{ source: false }"})</Code>.
        </LI>
        <LI>An older Vite cannot parse TSX in a plugin, so it does nothing there.</LI>
      </UL>

      <H2 id="connect">Connect, Express, or a plain server</H2>
      <P>Anything that takes <Code>(req, res, next)</Code> works.</P>
      <Pre file="server.js">{`import { createServer } from "node:http";
import { edityy } from "edityy";

createServer(edityy()).listen(3000);`}</Pre>

      <H2 id="nextjs">Next.js</H2>
      <P>
        Next renders the page itself, so a dev-server middleware cannot patch its HTML. Load the client bootstrap
        instead. Next runs it before hydration, so there is no route handler and no script tag in the layout.
      </P>
      <Pre file="instrumentation-client.ts">{`if (process.env.NODE_ENV === "development") import("edityy/client");`}</Pre>
      <P>
        Put the file in the project root, or in <Code>src/</Code> if your app is there. This works on Next.js 15.3 and
        later. The check keeps the launcher out of <Code>next build</Code>.
      </P>

      <H3>Next.js 16.3 and later</H3>
      <P>You can set the option in your config instead of the file.</P>
      <Pre file="next.config.ts">{`import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.NODE_ENV === "development" && {
    instrumentationClientInject: ["edityy/client"],
  }),
};

export default nextConfig;`}</Pre>
      <Note title="Do not use the option on Next.js 16.2 or earlier">
        Those versions do not know it. They print <Code>Unrecognized key(s) in object:{" "}
        &apos;instrumentationClientInject&apos;</Code>, ignore it, and show no launcher. Use the{" "}
        <Code>instrumentation-client.ts</Code> file there.
      </Note>

      <H3>Serving the script over HTTP</H3>
      <P>
        The launcher script is bundled into the page, so nothing extra is requested at runtime. If you would rather
        serve it over HTTP, to keep it out of your client bundle, add a script tag to your layout instead.
      </P>
      <Pre file="app/layout.tsx">{`<script src="/__edityy/edityy.js" defer />`}</Pre>
      <P>
        Serve that path with a route handler that returns <Code>launcher</Code> from <Code>edityy/inject</Code>. Next
        treats a folder that starts with an underscore as private and never routes it, so the route lives in a folder
        with an ordinary name, and the app rewrites the path onto it.
      </P>
      <Pre file="app/edityy/edityy.js/route.ts">{`import { launcher } from "edityy/inject";

export function GET() {
  return new Response(launcher, {
    headers: { "content-type": "text/javascript; charset=utf-8" },
  });
}`}</Pre>
      <Pre file="next.config.ts">{`async rewrites() {
  return [{ source: "/__edityy/edityy.js", destination: "/edityy/edityy.js" }];
}`}</Pre>
      <P>Use this approach on Next.js before 15.3, which has no <Code>instrumentation-client</Code> file.</P>

      <H2 id="next">Next</H2>
      <P>Reload the page. The launcher is in the bottom-right corner.</P>
    </>
  );
}
