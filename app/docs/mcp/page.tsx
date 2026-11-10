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
      <P>There are four: one read, two placers, one marker.</P>

      <H3 id="get-work">get_work</H3>
      <P>
        Returns every saved edit and every ask in one call, oldest first. Each edit carries an id such as{" "}
        <Code>c-0</Code>: apply it to the source code, then call <Code>mark_applied</Code>. Each ask carries a kind,
        an id and a status: answer a <Code>variants</Code> ask with <Code>place_variants</Code> and a{" "}
        <Code>preview-request</Code> ask with <Code>place_preview</Code>.
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
        Takes the answer: exactly that many variations of plain CSS declarations, for you to try on the live
        element. An answer for an old request is refused.
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
    },
    {
      "label": "notched",
      "props": [
        {
          "property": "background",
          "value": "#f43f5e",
          "on": "::-webkit-scrollbar-thumb"
        }
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

      <H3 id="place-preview">place_preview</H3>
      <P>
        The user typed <Code>edityy::</Code> in the agent chat. Place that change on the live canvas only. Do not edit
        files for it.
      </P>
      <P>
        Each preview is an instruction, an action, and the payload that action needs:
      </P>
      <UL>
        <LI>
          <Code>styles</Code> restyles one element: a selector and 1 to 10 labeled variations.
        </LI>
        <LI>
          <Code>insert</Code> adds allowlisted markup near an anchor, or at the end of <Code>main</Code>.
        </LI>
        <LI>
          <Code>update</Code> changes one element: its styles, its words or its markup.
        </LI>
        <LI>
          <Code>remove</Code> takes one element away.
        </LI>
      </UL>
      <Pre>{`{
  "instruction": "add a pricing section",
  "action": "insert",
  "position": "inside-end",
  "html": "<section class=\"pricing\"><h2>Plans</h2></section>"
}`}</Pre>
      <P>
        The page shows the preview with <strong>Keep</strong> and <strong>Discard</strong>. Keys <Code>1</Code> to{" "}
        <Code>0</Code> try each look of a styles preview, and <Code>Escape</Code> discards.
      </P>
      <Note title="Ask before you guess">
        If the user names no place and the place is unclear, ask them first. A preview that lands somewhere they did not
        mean is worse than a question.
      </Note>
      <Note title="Safety">
        Markup is allowlisted twice: once on the server, and again in the page before it paints. A script tag, an event
        attribute, an iframe, a form or a <Code>javascript:</Code> link is refused. So is a <Code>style</Code>{" "}
        attribute.
      </Note>

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
