import { H1, Lead, P, H2, H3, UL, LI, Code, Pre, Note } from "../ui";

export const metadata = {
  title: "Chat previews — Edityy Docs",
  description: "Type edityy:: in your agent and see the change on the canvas, not in the code.",
};

export default function DocsPreviews() {
  return (
    <>
      <H1>Chat previews</H1>
      <Lead>
        Type <Code>edityy::</Code> in your agent chat and the change appears on the running page. Your code is not
        touched until you say so.
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
        The agent calls <Code>place_preview</Code> with the instruction, an action and the payload that action needs.
        The page paints the result and shows it with <strong>Keep</strong> and <strong>Discard</strong>.
      </P>

      <H2 id="actions">The four actions</H2>
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

      <H2 id="deciding">Keeping or discarding</H2>
      <P>
        <strong>Keep</strong> leaves the change on the page as an ordinary Edityy edit. It counts in the edits list,
        it travels to <strong>Save to project</strong> and <Code>get_visual_changes</Code>, and <Code>Escape</Code>{" "}
        still puts it back.
      </P>
      <P>
        <strong>Discard</strong>, or <Code>Escape</Code>, puts the page back the way it was.
      </P>
      <H3>Several at once</H3>
      <P>
        When more than one preview is waiting, they show as a checkbox list instead of one card, and the canvas stays
        untouched until you decide. Every row reads ticked to start, keys <Code>1</Code> to <Code>9</Code> and{" "}
        <Code>0</Code> flip the tick on a row, and the one button under the list answers what the ticks say:
      </P>
      <UL>
        <LI>
          Anything ticked, it reads <strong>Keep all</strong>: every ticked preview is kept, and the rest are taken
          back.
        </LI>
        <LI>
          Nothing ticked, it reads <strong>Discard all changes</strong>: the whole list goes back.
        </LI>
        <LI>
          <Code>Escape</Code>, or leaving edit mode, takes back everything still waiting.
        </LI>
      </UL>
      <P>Each preview has an id, such as e-abc123. In the chat you can say what to do with it:</P>
      <Pre>{`implement e-abc123
discard e-abc123`}</Pre>
      <P>
        <Code>implement</Code> tells the agent to read the kept preview with <Code>get_preview</Code> and write it
        into your source; one kept from the canvas is also in the saved edits for <Code>get_visual_changes</Code>.{" "}
        <Code>discard</Code> calls <Code>decide_preview</Code> to mark it dropped.
      </P>
      <Note title="History after the list">
        A decided preview leaves the screen, but it stays in <Code>.edityy/previews.json</Code>, kept or discarded,
        and <Code>get_preview</Code> lists the past ones and returns one by id.
      </Note>

      <H2 id="asking-first">When the place is unclear</H2>
      <P>
        If you name no element and the place is not obvious, the agent should ask before it paints. A preview that
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
