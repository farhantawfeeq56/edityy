---
name: Edityy
description: Edityy — a visual editing layer for code-based websites, on warm paper in graphite ink, with one gold
colors:
  primary: "#25241f"
  secondary: "#5d5a50"
  tertiary: "#8a6a10"
  neutral: "#faf9f6"
  surface: "#ffffff"
  on-primary: "#faf9f6"
  muted: "#5d5a50"
  border: "#25241f1a"
  brand-gold: "#d4a72c"
  brand-ink: "#8a6a10"
  brand-soft: "#fbf3d9"
  brand-line: "#e9d28b"
  accent-rose: "#e9d28b"
  accent-blush: "#fbf3d9"
typography:
  h1:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 4.25rem
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: -0.03em
  h2:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 2.5rem
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.02em
  body-md:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.3
  label:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.2
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  pill: 28px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: 12px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.lg}"
    padding: 24px
  section-muted:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary}"
    rounded: "{rounded.xl}"
    padding: 40px
  input:
    backgroundColor: "{colors.on-primary}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 12px
  caption:
    backgroundColor: "{colors.on-primary}"
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    padding: 8px
  badge-rose:
    backgroundColor: "{colors.brand-line}"
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    padding: 8px
  badge-blush:
    backgroundColor: "{colors.brand-soft}"
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    padding: 8px
  button-accent:
    backgroundColor: "{colors.brand-gold}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 12px
  divider:
    backgroundColor: "{colors.border}"
    rounded: "{rounded.sm}"
    height: 1px
  signal-rose:
    backgroundColor: "{colors.secondary}"
    rounded: "{rounded.pill}"
    size: 12px
---

## Overview

Edityy sits between a codebase and a visual editing interface: a Components
Editor for AI-assisted building and an editor for structured content like
posts and landing copy. The UI is warm paper with graphite ink, one gold
doing the signalling, and one semibold headline over quiet 400 copy. The feel
is a calm workbench — quiet surfaces, one strong ink button, no gradients on
core UI.

## Visual reference

The look is a printed page: a warm off-white stock, one soft graphite ink, and
one gold that is used sparingly enough to stay a signal.

What carries over:

- **Warm paper, not white.** The page is `#faf9f6` and the surfaces that float
  on it are `#ffffff`. The paper is warmer than the cards, never the reverse.
- **Graphite, not black.** Ink is `#25241f`. Nothing in the app is pure black.
- **One colour, and it is a fill.** Gold `#d4a72c` marks state. It is never a
  thin line of colour and never small text on paper.
- **Hairlines for structure, shadow for height.** Separation comes from a 1px
  hairline in the ramp, and a floating surface adds one diffuse shadow and
  nothing else.
- **Weight carries the hierarchy, not a second face.** A headline is 600 and
  every control, label and paragraph is 400 or 500, all in one face.
What does not carry over: gradients, a texture or grain overlay, a second
neutral ramp, and any hue beyond the gold.

## Colors

Warm paper under graphite ink, with one gold doing the signalling.

- **Primary (#25241f):** Graphite ink. Headlines, body text, the primary
  button, the orb. Never pure black.
- **Secondary (#5d5a50):** Muted graphite. Hover fills on ink buttons, muted
  copy on paper. Also the muted colour the editor chrome reads.
- **Tertiary (#8a6a10):** Brand ink. The keyboard ring, an active state and a
  small label that must read in the brand hue.
- **Neutral (#faf9f6):** Paper. The canvas. The page's brightest warm value.
- **Surface (#ffffff):** Cards and the editor chrome. The one surface that is
  whiter than the page, so a floating layer reads as being over it.
- **On-primary (#faf9f6):** Text and icons on ink fills. Paper, not white.
- **Muted (#5d5a50):** Secondary copy, timestamps, captions on paper.
- **Border (#25241f1a):** Hairline dividers between panes — ~10% ink.
- **Brand gold (#d4a72c):** A fill that marks state, with ink on it. Never a
  hairline and never small text: gold on paper is 2.1:1.
- **Brand ink (#8a6a10):** Gold turned into something that can be read — a
  ring, a word, a one-pixel rule.
- **Brand soft (#fbf3d9) / Brand line (#e9d28b):** The fill and the hairline of
  a control that is open or a row that is chosen, always with ink on them.

The ramp runs paper → brand-soft → brand-line → gold → brand-ink → ink.
There is no sixth value, and nothing is pure black. Every neutral step is
warm: a grey in this ramp is a bug, not a variant.

The token names `rose-500`, `rose-600`, `rose-900`, `blush`, `rose` and `plum`
are kept in `app/globals.css` as aliases of the values above, so no class in
the app had to be renamed. They are the old names of these values; a new
class uses the `brand-*` and `neutral-*` names.

## Typography

The ramp is carried by weight and size. One face ships: Plus Jakarta Sans.

- **Page title (4.25rem / 600 / -0.03em):** one per view, set in open,
  low-detail space.
- **Section title (1.875rem / 600 / -0.02em, 2.5rem from the `sm` breakpoint):**
  one per section.
- **Card title (0.9375rem / 600):** panels and lists.
- **Body-md (1rem / 400):** paragraphs and agent instructions, max ~35rem
  measure.
- **Label (0.875rem / 500):** form-field names, plus buttons, nav links
  and badges.
- **Overline (0.6875rem / 500 / 0.12em, uppercase):** the small line over a
  section. It is a label, not a title, and it is one utility (`overline`)
  rather than a class written again in every file.

Body and meta text is 400, a name or an action is 500, a heading is 600.
Those three weights are exactly what is shipped — the site loads Plus
Jakarta Sans 400/500/600 (Latin subset) from `app/fonts` via
`next/font/local`, because `next/font/google` fetches at build time and
fails on restricted networks.

`--font-sans`, `--font-display` and `--font-mono` all resolve to this one
face, so a class that asks for a display or a code face still gets Jakarta.
A second face — a display face, or a mono for code blocks — is a later
decision that needs a bundled file under `app/fonts` and a PR of its own.
Until then, do not measure a line break against a face that is not shipped.

## Interaction model

Progressive revelation. The interface reveals itself in layers rather than
opening all at once.

    Quiet canvas → Orb → Floating layer → Deeper layer → Collapse

- The app opens on a clean, quiet canvas with a **persistent orb** in the
  bottom-right. The orb is the single entry point to the interface.
- Activating the orb grows controls out of it as **floating layers**. They
  sit above the canvas; they never take over the screen.
- Selecting something opens a **deeper contextual layer**, and the layer
  below it recedes rather than disappearing.
- Every layer stays **spatially connected to the orb**, so the user always
  knows where the hierarchy came from and what it collapses back into.
- Controls that aren't needed stay hidden. Unrevealed controls have no
  footprint in the layout.
- Closing collapses the layers back into the orb. Reversible, always.

**Depth is the characteristic that matters.** Controls must not feel like
a conventional menu dropped on top of the app — they must feel like
layers of the interface being uncovered. Achieve it with paper translucency
and backdrop blur (the mist), a soft outer shadow so each layer floats
above the last (the haze), and a short scale-and-fade on entry. Do it with
those, not with heavier borders or gradient panels.

## Layout

Centered column, max content ~58rem, generous vertical rhythm.
Section padding 5.25rem top on desktop; editor card grids use
0.75–1.5rem gaps. Instruction and copy blocks center with auto margins.
Nav is a floating pill bar over the canvas, not a full-bleed strip — the
orb anchors the bottom-right corner and shares that floating posture.

## Elevation & Depth

Almost flat by default; depth is reserved for the revealed interaction
layers. Base UI gets depth from two paper values, not shadows — a card sits on
Surface with a hairline border and no shadow. Floating layers lift with the
one `layer` shadow (`--shadow-layer`: `0 1px 2px` + `0 8px 24px -14px` at 5%
and 22% ink) plus backdrop blur. Dark panels invert: paper text on Primary
with paper hairlines at 10%.

## Shapes

Small radii on UI, large on content cards. Buttons 8px, inputs 8px,
status badges and signal dots fully pill (28px), editor cards 12–16px.
Divider ticks 2px. The orb is fully round. Never square buttons, never
over-round cards into bubbles.

The one pill that is not a badge is the site's nav bar: the *bar* is round and
every control inside it is 8px. A button is never a pill.

## Components

- **Primary button:** ink fill, paper label, 8px radius, `0.75rem 1rem`
  padding, flex with 0.5rem gap. Hover steps to Secondary.
- **Secondary button:** paper fill at ~75% opacity with blur over dark,
  ink label, same radius.
- **Card:** Surface fill, ink text, 12px radius, 24px padding, hairline
  border. Used for editor panels and agent-instruction blocks. A card that
  floats asks for the `layer` utility: one hairline and one shadow, both from
  the same two tokens.
- **Muted section:** Neutral fill, ink text, 16px radius, 40px padding.
- **Input:** one chip holds the glyph and the value: hairline border, paper
  fill, 8px radius, and as wide as the digits plus one more. The border is
  there at rest; hover adds ink, focus takes the warm fill, and a press goes to
  `scale(.96)` and back. It is the shape of every value field in the editor.
- **Control that is open, or row that is chosen:** brand-soft fill and a
  brand-line hairline, with ink on both. One mark, and it is the same mark in
  the dock, in a list and in the element card.
- **Keyboard ring:** one 2px outline in brand ink, 2px off the control, on
  every button in the chrome. Not a shadow ring, so it survives forced-colors
  mode and never fights a surface's own shadow.
- **Badges:** brand-soft or brand-line fill, ink text, pill radius. Used for
  content state.
- **Divider:** border-ink 1px line. **Signal dots:** 12px pills in gold for
  agent/sync status, decorative only.
- **Orb:** a single filled circle, Primary, bottom-right, persistent.
  Its only job is to be the thing you press to reveal more.
- **Floating layer:** paper Surface with a hairline, the `layer` shadow, and
  the backdrop blur, rounded `xl`, anchored to the orb's position. One depth
  level per layer.

## Motion

Motion is quiet and it is named. The timings live in one file,
`packages/edityy/src/motion.css`, and both the editor chrome and this site
read them, so a thing that arrives in the editor arrives in the same time on
the page.

**Five curves, and each one has a job.**

- **Arrive** is a long ease-out, so the way in is felt.
- **Leave** is a short ease-in, so the way out is not waited for.
- **Standard** is the even curve for a value under the pointer.
- **Travel** carries the orb's shrink and its journey in one move.
- **Breathe** is the only one that never arrives: it is the loop that says
  "waiting".

**Nine durations, and each one is named for what it is for.** `press` is the
press going down, `fade` is a short disappearance, `tint` is a colour change,
`slide` is a value moving under the pointer, `settle` is a value coming to
rest, `enter` is a surface arriving, `rise` is a surface rising, `move` is
the orb's own journey, and `pulse` is the waiting loop. A duration is never
written out in a rule: it is a token, so one change moves everything that
uses it.

**The rules.**

- Things arrive on the arrive curve and leave on the leave curve. A panel
  that is dismissed leaves as carefully as it came, and a panel whose
  content changes under the reader's eyes crosses rather than cuts.
- A row of controls that changes its set keeps the controls both sets have.
  They travel to their new places, the rest cross over, and the row takes
  its new width with them. The pointer's fill waits for the pointer to move,
  because the control it was measured on is gone.
- A press goes down fast and comes back slow, because the hand is quick and
  the release settles. Every control that answers the pointer presses the
  same way, and a control that only changes colour does not press at all.
- A value that comes to rest says so with a small beat, so the number the
  reader is looking at is the number.
- A surface follows the pointer without a delay. The orb is under the cursor,
  not chasing it.
- An animation that is interrupted continues from where the element is
  showing, not from where it was.
- A control that already says what it is needs no tip. The words on the
  button are the tip, and a second one under the pointer is noise.
- A list that answers the pointer is not built again. The tick moves, the row
  the pointer is on stays, and a card that rebuilds itself on every scroll
  is a card that blinks.

**Less motion means no motion.** Under `prefers-reduced-motion: reduce`
every duration collapses, every animation runs once and stops, and every
delay goes. The rule is one rule, in the stylesheet and in the chrome, and it
is not a list of selectors to keep in step with the code by hand.

## Texture

There is none. The page carries no grain, no noise and no repeating pattern:
the palette is two neutrals and one gold, and a texture on top of it made the
paper read as graded rather than chosen. Warmth comes from the paper value
itself, not from a veil over it.

## Do's and Don'ts

- Do give each view one display-sized title, placed in open space, and set it
  in semibold; do not reintroduce Geist, and do not add a second face without
  a bundled file and a PR of its own.
- Do keep editor copy on paper with ink text; don't put body copy on gold or
  on a brand fill.
- Do use ink or paper text on gold; don't use gold for a hairline, a small
  label or a keyboard ring — that is what brand ink is for.
- Do use brand fills with ink text for content-state badges; don't use them
  for the primary button.
- Do let interaction layers float on one hairline and one shadow; don't add
  gradients, grain or a second shadow recipe.
- Do keep the orb the single entry point; don't spread controls across a
  permanent toolbar.
- Do press every control that answers the pointer by the same amount, in the
  shared press rule; don't write a local `:active`.
- Do give every button the one keyboard ring; don't draw a ring of your own
  and don't let a control fall back to the browser's.
- Don't introduce pure black, a cool grey, or a new hue — the ramp is closed.