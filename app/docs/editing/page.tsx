import { H1, Lead, P, H2, H3, UL, LI, Code, Note } from "../ui";

export const metadata = {
  title: "The editing mode — Edityy Docs",
  description: "The dock, the element actions, the keyboard, and the fonts.",
};

export default function DocsEditing() {
  return (
    <>
      <H1>The editing mode</H1>
      <Lead>
        Click the launcher and the page becomes editable. The button shrinks into the pointer, and the dock appears at
        the bottom centre of the viewport.
      </Lead>

      <H2 id="selecting">Selecting an element</H2>
      <UL>
        <LI>Hover outlines an element. A click selects it, and the page’s own click handlers do not run.</LI>
        <LI>Shift-click adds an element to the selection, or removes it.</LI>
        <LI>
          The arrow keys move the selection: <Code>↑</Code> to the parent, <Code>↓</Code> to the first child,{" "}
          <Code>←</Code> and <Code>→</Code> to the siblings. In editable words they need <Code>Alt</Code>.
        </LI>
      </UL>

      <H2 id="element-actions">The element actions</H2>
      <P>
        Selecting an element opens a card at that element. The card holds <strong>Edit text</strong>,{" "}
        <strong>Move</strong>, <strong>Comment</strong>, <strong>Variations</strong> and <strong>Delete</strong>.
      </P>
      <UL>
        <LI>Text is not editable until you choose <strong>Edit text</strong>.</LI>
        <LI>Move previews a new position among the siblings.</LI>
        <LI>
          A comment travels with the edit. It reaches the saved file and the Markdown your agent reads.
        </LI>
        <LI>Delete is temporary. It goes away when you leave the mode, and <Code>⌘Z</Code> undoes it.</LI>
      </UL>

      <H2 id="the-dock">The dock</H2>
      <P>
        The dock stays in one place at the bottom centre. It does not follow the element, and an open control comes
        out over it. While a control, or one of the lists inside a button, is open, the element actions stand down.
        They come back when it closes.
      </P>
      <P>The controls follow the element you selected.</P>
      <UL>
        <LI>Text starts with font family, weight, size, line height, letter spacing, alignment, decoration and colour.</LI>
        <LI>A container or a media element starts with padding and margin.</LI>
        <LI>
          The <Code>+</Code> adds shadow, fill, border, padding and margin to that one element.
        </LI>
      </UL>

      <H3>Layout</H3>
      <P>A container’s layout mode decides its controls.</P>
      <UL>
        <LI>Flex shows direction, wrap, alignment and gap.</LI>
        <LI>
          Grid shows its columns and rows as <Code>columns × rows</Code>, and a count of <Code>auto</Code> where the
          grid names no tracks of that axis. It shows no alignment control, because a grid places its own cells.
        </LI>
        <LI>
          Absolute shows its top, right, bottom and left offsets, and no width or height.
        </LI>
      </UL>

      <H3>Shadow</H3>
      <P>
        A shadow follows what it is on. The words of a text element are shadowed with <Code>text-shadow</Code>. A box
        is shadowed with <Code>box-shadow</Code>. The offsets and the blur are fields in the panel, two to a line,
        with the colour under them.
      </P>

      <H3>Numbers</H3>
      <P>
        Every number is a field you type into. No slider stands beside a field. A spacing that would need a word wears
        a glyph instead, and the word stays on the field for a screen reader.
      </P>
      <P>
        Font size and font weight are one value each: a field, and an arrow that opens the common values. A value from
        the list writes the field. It is never shown twice.
      </P>

      <H3>Colour</H3>
      <P>Every colour is picked in the same picker.</P>
      <UL>
        <LI>The text colour, a fill, a border and a shadow all use it.</LI>
        <LI>It has a saturation and brightness field with a dot to drag, and the hue slider.</LI>
        <LI>One line holds the hex code and the transparency as a percentage.</LI>
        <LI>
          The field takes <Code>#rgb</Code>, <Code>#rrggbb</Code>, <Code>#rrggbbaa</Code>, <Code>rgb()</Code> or{" "}
          <Code>rgba()</Code>.
        </LI>
        <LI>
          A colour with any transparency is written as <Code>rgba(r, g, b, a)</Code>. A solid one stays{" "}
          <Code>#rrggbb</Code>.
        </LI>
      </UL>

      <H2 id="text">Editing text</H2>
      <P>
        Words are typed into where they stand. An element whose words are split by a child element, such as a paragraph
        around a link, is editable too. The words change in place, and the markup goes back as it was when you leave
        the mode.
      </P>
      <P>
        The caret starts at the end of the words, not where the click landed. The card then holds <strong>Done</strong>{" "}
        alone: a click in the words moves the caret, and <strong>Done</strong> gives the words back.
      </P>

      <H2 id="fonts">Fonts</H2>
      <P>
        The font family control lists the fonts the page has, then the Google Fonts catalog, with a search field over
        both. The button in the dock shows the family name in that family.
      </P>
      <Note title="Nothing loads with the page">
        The first open of the control fetches the catalog of names, about 35 KB, once for each page visit. A pick loads
        that whole family, and the browser downloads only the weights and styles the page uses. A Google font you pick
        is not added to your project. Add it to your code when you keep the edit.
      </Note>

      <H2 id="keyboard">The keyboard</H2>
      <UL>
        <LI>
          <Code>Shift+A</Code> wraps the selected siblings in a column flex container.
        </LI>
        <LI>
          <Code>Escape</Code> closes the open control, then leaves the mode.
        </LI>
        <LI>
          <Code>⌘Z</Code> and <Code>Ctrl+Z</Code> undo. <Code>⇧⌘Z</Code> and <Code>Ctrl+Y</Code> redo.
        </LI>
        <LI>
          <Code>←</Code> and <Code>→</Code> move along the icons in the dock.
        </LI>
        <LI>
          <Code>Shift+Arrow</Code> does not extend the selection.
        </LI>
      </UL>

      <H2 id="undo">What an edit is</H2>
      <P>
        Every edit is one inline style on the live page. Edits are kept in <Code>sessionStorage</Code> while the mode
        is on, so a reload or a hot update brings them back. Leaving the mode reverts all of them.
      </P>
    </>
  );
}
