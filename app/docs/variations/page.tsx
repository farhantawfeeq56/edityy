import { H1, Lead, P, H2, H3, UL, LI, Code, Pre, Note } from "../ui";

export const metadata = {
  title: "Style variations — Edityy Docs",
  description: "Ask your agent for style variations of one element.",
};

export default function DocsVariations() {
  return (
    <>
      <H1>Style variations</H1>
      <Lead>
        Select one element and choose <strong>Variations</strong> in its actions. Your agent answers with several
        looks for that element. You pick the one you want.
      </Lead>

      <H2 id="asking">Asking for variations</H2>
      <P>
        The box asks two things: how many variants to make, 2 to 10, and an optional comment, such as “thinner and
        darker”. Press <strong>Send to agent</strong>.
      </P>
      <P>
        The box then becomes the waiting card. It says <strong>Waiting for your agent</strong>, names the keyword{" "}
        <Code>vartest</Code>, and says to say what you want in the same message. An <strong>X</strong> puts the card
        away.
      </P>
      <P>
        In your agent, type <Code>vartest</Code> and say what you want in the same message. The agent follows your own
        words as well as the comment. If your agent has no Edityy server yet, add one with{" "}
        <Code>npx edityy mcp</Code> and ask again.
      </P>

      <H2 id="answering">Answering</H2>
      <P>Your agent has one job, in two tool calls.</P>
      <UL>
        <LI>
          <Code>get_variation_request</Code> returns the number of variations, the comment, the element’s tag, its
          selector and a few current values. Read it at the start of every <Code>vartest</Code>: you may have asked
          again since the last one, and an answer for an old request is refused.
        </LI>
        <LI>
          <Code>place_variations</Code> takes the answer. It takes that many variations, each a short label and a list
          of declarations.
        </LI>
      </UL>
      <P>
        Fewer variations than you asked for is refused, and the message says so. More is not a refusal: the first ones
        are the ones you see.
      </P>
      <Pre>{`thin grey | scrollbar-width: thin; scrollbar-color: #8a8a8a transparent
rose pill | scrollbar-color: #f43f5e #f4f4f5
notched | on: ::-webkit-scrollbar-thumb, background: #f43f5e
narrow | when: (max-width: 640px), padding: 8px`}</Pre>

      <H2 id="picking">Picking one</H2>
      <P>
        A strip at the bottom right shows the variations. It names the element it varies, and <strong>Keep</strong> is
        grey until one of them is on the element. Keys <Code>1</Code> to <Code>9</Code> pick one, and <Code>0</Code>{" "}
        picks the tenth. <strong>Keep</strong> puts the strip away.
      </P>
      <P>
        What is left on the element is an ordinary edit. <strong>Save to project</strong> and{" "}
        <Code>get_visual_changes</Code> carry it like any other. <Code>Escape</Code> or leaving the mode reverts it.
      </P>

      <H2 id="states">States, pseudo-elements and breakpoints</H2>
      <P>A declaration that carries <Code>on</Code> is a state or a pseudo-element of the element itself.</P>
      <Pre>{`:hover
:focus-visible
::before
::-webkit-scrollbar-thumb`}</Pre>
      <P>A declaration that carries <Code>when</Code> is a breakpoint.</P>
      <Pre>{`(max-width: 640px)`}</Pre>
      <P>
        The browser cannot show either in the element’s own inline style, so Edityy writes them into a small stylesheet
        it adds to the page for that element. It takes the sheet away when the edit is reverted or the mode ends.
      </P>
      <P>
        They travel with the edit. <strong>Save to project</strong> and the copied Markdown name the state or the
        breakpoint beside the property, and your agent writes the rule in your own stylesheet.
      </P>
      <Note title="A pseudo-element needs content">
        A <Code>::before</Code> or <Code>::after</Code> needs a <Code>content</Code> value to show at all.
      </Note>

      <H2 id="under-the-hood">Under the hood</H2>
      <P>
        The endpoint is <Code>POST</Code>, <Code>GET</Code> and <Code>DELETE /__edityy/variations</Code>. A request and
        its answer are written to <Code>.edityy/variation-request.json</Code> and{" "}
        <Code>.edityy/variation-response.json</Code>, which the MCP server reads.
      </P>
      <P>
        The page sends only plain values, and an answer is checked before the page shows it. A custom property, an
        at-rule in place of <Code>when</Code>, <Code>!important</Code> or <Code>url()</Code> is refused.
      </P>
      <P>
        The <strong>X</strong> in the waiting card takes the request back. The request stays in the file, marked as
        taken back, and the agent is told not to answer it. A withdrawal is not the same as a request that was never
        made. A new request replaces it.
      </P>

      <H3>Next.js</H3>
      <P>Next.js needs one more route file and one more rewrite, next to the one for the edits.</P>
      <Pre file="app/edityy/variations/route.ts">{`import { variationsRoute } from "edityy";

export const { GET, POST, DELETE } = variationsRoute();`}</Pre>
      <Pre file="next.config.ts">{`async rewrites() {
  return [{ source: "/__edityy/variations", destination: "/edityy/variations" }];
}`}</Pre>
    </>
  );
}
