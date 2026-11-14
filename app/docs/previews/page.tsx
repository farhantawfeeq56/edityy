import { H1, Lead, P, H2, H3, UL, LI, Code, Pre } from "../ui";

export const metadata = {
  title: "Chat previews — Edityy Docs",
  description: "Type edityy:: in your agent and get the change in the source code.",
};

export default function DocsPreviews() {
  return (
    <>
      <H1>Chat previews</H1>
      <Lead>
        Type <Code>edityy::</Code> in your agent chat and the agent writes the change into your source code. The
        temporary canvas is removed: nothing is painted, and there is nothing to keep or discard.
      </Lead>

      <H2 id="asking">Asking from the chat</H2>
      <P>
        The change starts in your agent, not on the page. Type the keyword, then the change you want, in one message.
      </P>
      <Pre>{`edityy:: add a pricing section with three cards
edityy:: make the hero heading bigger and tighter
edityy:: change this button to say Start free
edityy:: remove the grey banner above the footer`}</Pre>
      <P>
        The agent writes the change into the source code directly. A popped card in the Edits panel shows the
        element name, the variant name, the numbered chips, Notes, and <strong>x</strong> and tick.
      </P>

      <H2 id="actions">The four actions</H2>
      <P>Each change the agent writes is one of four kinds:</P>
      <UL>
        <LI>
          <Code>styles</Code> restyles one element: a selector and 1 to 10 labeled looks. Keys <Code>1</Code> to{" "}
          <Code>0</Code> try each one, as with variations.
        </LI>
        <LI>
          <Code>insert</Code> adds markup near an anchor, or at the end of <Code>main</Code> when you name none.
        </LI>
        <LI>
          <Code>update</Code> changes one element: its styles, its words or its markup.
        </LI>
        <LI>
          <Code>remove</Code> takes one element away.
        </LI>
      </UL>

      <H2 id="deciding">Deciding</H2>
      <P>
        The popped card carries <strong>x</strong> and tick. <strong>x</strong> drops the card. The tick keeps
        the change as an ordinary Edityy edit: it counts in the edits list, and it travels to{" "}
        <strong>Save to project</strong> and <Code>get_work</Code>.
      </P>

      <H2 id="asking-first">When the place is unclear</H2>
      <P>
        If you name no element and the place is not obvious, the agent should ask before it writes. A change that
        lands somewhere you did not mean is worse than a question.
      </P>

      <H2 id="safety">What markup is allowed</H2>
      <P>
        A preview may carry structure, headings, words and pictures. It is checked twice: once on the server, and
        again in the page before anything is painted.
      </P>
      <P>Refused, on both sides:</P>
      <UL>
        <LI>
          <Code>script</Code>, <Code>style</Code>, <Code>iframe</Code>, <Code>form</Code> and <Code>object</Code> tags.
        </LI>
        <LI>
          Event attributes, such as <Code>onclick</Code>.
        </LI>
        <LI>
          A <Code>style</Code> attribute or a custom property: styles travel as declarations, not as markup.
        </LI>
        <LI>
          A link that runs code, such as <Code>javascript:</Code> or <Code>data:</Code>.
        </LI>
      </UL>

      <H2 id="under-the-hood">Under the hood</H2>
      <P>
        The endpoint is <Code>GET</Code>, <Code>POST</Code> and <Code>DELETE /__edityy/previews</Code>. A placed
        preview is written to <Code>.edityy/previews.json</Code>, which the MCP server and the page both read.
      </P>
      <P>
        The page asks the endpoint for every preview still up for a decision while the editing mode is on. One waiting
        preview paints; several wait as the list. A preview that names an
        element the page does not have is dropped, so nothing paints in the wrong place.
      </P>

      <H3>Next.js</H3>
      <P>Next.js needs one more route file and one more rewrite, next to the ones for the edits and variations.</P>
      <Pre file="app/edityy/previews/route.ts">{`import { previewsRoute } from "edityy";

export const { GET, POST, DELETE } = previewsRoute();`}</Pre>
      <Pre file="next.config.ts">{`async rewrites() {
  return [
    { source: "/__edityy/variations", destination: "/edityy/variations" },
    { source: "/__edityy/previews", destination: "/edityy/previews" },
  ];
}`}</Pre>
    </>
  );
}
