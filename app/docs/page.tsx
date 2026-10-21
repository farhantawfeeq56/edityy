import Link from "next/link";
import { H1, Lead, P, UL, LI, Code, Note, Pre, H2 } from "./ui";

export const metadata = {
  title: "Overview — Edityy Docs",
  description: "What Edityy does, what it does not do, and where the changes go.",
};

export default function DocsOverview() {
  return (
    <>
      <H1>Edityy</H1>
      <Lead>
        Edityy puts a visual editor on the site you already run. You change the page in the browser, and your coding
        agent makes the change in the code.
      </Lead>

      <H2 id="what-it-does">What it does</H2>
      <P>The launcher sits in the bottom-right corner of your site. Click it, and the page answers to you.</P>
      <UL>
        <LI>Point at an element and click it. The page selects it.</LI>
        <LI>Change the type, the colour, the spacing, the fill, the border and the shadow.</LI>
        <LI>Type new words into the text that is already there.</LI>
        <LI>Ask your agent for style variations of one element.</LI>
        <LI>Hand the edits over as a prompt, a file, or a message over MCP.</LI>
      </UL>

      <P>
        Every edit is one inline style on the live page. Edityy writes nothing to your source code. You keep the
        codebase as the source of truth, and the agent changes it.
      </P>

      <Pre>{`your codebase → your dev server → edityy middleware → the page, with a launcher`}</Pre>

      <H2 id="how-the-launcher-gets-there">How the launcher gets there</H2>
      <P>
        The middleware serves <Code>/__edityy/edityy.js</Code> and injects a relative script tag into the HTML your
        dev server already returns. A relative URL follows whatever port your server runs on, so there is nothing to
        configure.
      </P>
      <P>
        The launcher mounts a host element that is fixed to the viewport and ignores pointer events. It renders inside
        an open shadow root, so your CSS cannot restyle it and it cannot leak styles back out.
      </P>
      <Note title="Leave the mode">
        Leaving the editing mode puts the page back exactly as it was. Your edits stay in <Code>sessionStorage</Code>{" "}
        until you close the mode, so a reload or a hot update brings them back.
      </Note>

      <H2 id="where-the-edits-go">Where the edits go</H2>
      <P>There are three ways to hand the edits over. Each one suits a different habit.</P>
      <UL>
        <LI>
          <Link href="/docs/handoff#copy" className="text-neutral-900 underline decoration-neutral-300 underline-offset-4">
            Copy for an agent
          </Link>{" "}
          copies the edits as Markdown. You paste them into your agent yourself.
        </LI>
        <LI>
          <Link href="/docs/handoff#save" className="text-neutral-900 underline decoration-neutral-300 underline-offset-4">
            Save to project
          </Link>{" "}
          writes the edits to <Code>.edityy/changes.json</Code> in your project.
        </LI>
        <LI>
          <Link href="/docs/mcp" className="text-neutral-900 underline decoration-neutral-300 underline-offset-4">
            MCP
          </Link>{" "}
          lets the agent read that same file, with no copy and no paste.
        </LI>
      </UL>

      <H2 id="next">Next</H2>
      <UL>
        <LI>
          <Link href="/docs/install" className="text-neutral-900 underline decoration-neutral-300 underline-offset-4">
            Install
          </Link>{" "}
          puts the launcher on your site. One line of config.
        </LI>
        <LI>
          <Link href="/docs/editing" className="text-neutral-900 underline decoration-neutral-300 underline-offset-4">
            The editing mode
          </Link>{" "}
          explains the dock and the keyboard.
        </LI>
        <LI>
          <Link href="/docs/api" className="text-neutral-900 underline decoration-neutral-300 underline-offset-4">
            API
          </Link>{" "}
          lists the options, the exports and the events.
        </LI>
      </UL>
    </>
  );
}
