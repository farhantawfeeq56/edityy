import { H1, Lead, P, H2, H3, Code, Pre } from "../ui";

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

      <H3 id="removed-placers">Removed: place_variants and place_preview</H3>
      <P>
        The temporary canvas is removed, and the two placers are gone with it. The agent answers every ask by
        writing into the source code. A client that still calls one gets a message that says so.
      </P>
      <P>
        Each answer carries a short label per variant. The popped card shows the label as its variant name, beside
        the numbered chips.
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
