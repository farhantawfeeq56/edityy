import { H1, Lead, P, H2, H3, UL, LI, Code, Pre, Note } from "../ui";

export const metadata = {
  title: "The MCP server — Edityy Docs",
  description: "Give a coding agent the saved edits and every ask in one read.",
};

export default function DocsMcp() {
  return (
    <>
      <H1>The MCP server</H1>
      <Lead>
        <Code>npx edityy mcp</Code> is a stdio MCP server. It hands the saved edits and every ask to a
        coding agent.
      </Lead>

      <H2 id="adding">Adding the server</H2>
      <H3>Claude Code</H3>
      <Pre file="terminal">{`claude mcp add edityy -- npx edityy mcp`}</Pre>
      <H3>Cursor, or any client configured with JSON</H3>
      <Pre file="mcp.json">{`{
  "mcpServers": {
    "edityy": { "command": "npx", "args": ["edityy", "mcp"] }
  }
}`}</Pre>
      <P>
        The server reads from the directory it is started in. Pass <Code>--root &lt;dir&gt;</Code> to read from
        another one.
      </P>

      <H2 id="tools">The tools</H2>
      <P>There are three: one read, one marker, one clearer. The two placers are removed with the canvas.</P>

      <H3 id="get-work">get_work</H3>
      <P>
        Returns every saved edit and every ask in one call, oldest first. Each edit carries an id such as{" "}
        <Code>c-0</Code>: apply it to the source code, then call <Code>mark_applied</Code>. Each ask carries a kind,
        an id and a status. The agent answers every ask in the source code: the temporary canvas is removed, so
        nothing is painted.
      </P>
      <P>
        The agent calls it once per turn. A kept preview arrives here as an edit of its own, with no save step.
      </P>

      <H3 id="mark-applied">mark_applied</H3>
      <P>
        Marks saved edits applied, so they are not applied twice. Pass the edit ids that are in the code now. With
        no ids, every saved edit is marked. That also clears the canvas session.
      </P>

      <H3 id="place-variants">place_variants</H3>
      <P>
        Returns what you asked for on one element: the number of variations, their optional comment, the element’s
        tag, its selector and its current values. The agent never sees your code for this.
      </P>
      <P>
        Takes the answer: exactly that many variations, each a short label and a list of declarations. Nothing is
        painted. The user picks one on the popped card, the kept pick arrives as a saved edit, and the agent
        carries that edit into the source code.
      </P>
      <P>Each variation is a label and a list of declarations.</P>
      <Pre>{`{
  "requestId": "the id get_work returned",
  "variations": [
    {
      "label": "thin grey",
      "props": [
        { "property": "scrollbar-width", "value": "thin" },
        { "property": "scrollbar-color", "value": "#8a8a8a transparent" }
      ]
    }
  ]
}`}</Pre>
      <UL>
        <LI>
          <Code>on</Code> is a state or a pseudo-element, such as <Code>:hover</Code>, <Code>:focus-visible</Code> or{" "}
          <Code>::before</Code>.
        </LI>
        <LI>
          <Code>when</Code> is a media condition, such as <Code>(max-width: 640px)</Code>.
        </LI>
        <LI>
          A custom property, an at-rule in place of <Code>when</Code>, <Code>!important</Code> or <Code>url()</Code>{" "}
          is refused.
        </LI>
      </UL>
      <Note title="Place exactly what was asked for">
        Any other count than the asked one is refused: fewer leaves a slot empty, and more has nowhere to go.
      </Note>

      <H3 id="removed-preview">Removed: place_preview</H3>
      <P>
        The preview canvas is removed, and its placer is gone with it. The agent writes every preview change into
        the source code directly. A client that still calls it gets a message that says so.
      </P>

      <H2 id="the-files">The files</H2>
      <P>The server and the page share six files in your project.</P>
      <Pre>{`.edityy/
  changes.json             the saved edits
  variation-request.json   what you asked for
  variation-response.json  what the agent answered
  preview-request.json     the comment-box preview asks
  previews.json            the canvas previews and their history
  session.json             the canvas across a reload`}</Pre>
      <P>
        The folder gets its own <Code>.gitignore</Code>, so pending edits never end up in a commit. Your agent reads
        the same files the page writes.
      </P>
    </>
  );
}
