---
name: Edityy
description: Edityy — a visual editing layer for code-based websites, on warm paper, in mist-graded rose
colors:
  primary: "#3a283c"
  secondary: "#86546b"
  tertiary: "#b6758b"
  neutral: "#f9f2ee"
  surface: "#f9f2ee"
  on-primary: "#f9f2ee"
  muted: "#86546b"
  border: "#3a283c1a"
  accent-rose: "#d79eac"
  accent-blush: "#ecc5c9"
typography:
  h1:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 2.75rem
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -1.76px
  h2:
    fontFamily: "Plus Jakarta Sans"
    fontSize: 1rem
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.48px
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
    backgroundColor: "{colors.accent-rose}"
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    padding: 8px
  badge-blush:
    backgroundColor: "{colors.accent-blush}"
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    padding: 8px
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
posts and landing copy. The UI is a warm paper canvas with plum ink
headlines and rose signals. The feel is a calm workbench — quiet
surfaces, one strong dark button, no gradients on core UI.

## Visual reference

The look is set by one reference frame: a hazy, vintage analog photograph
of a pagoda in morning mist — heavy aquatint texture, monochromatic
grading, dense atmospheric fog. Read it as a **tonal** reference, never a
literal one. Nothing in the app is a pagoda, a mountain, or a fog bank;
what transfers is the *quality of light*.

What carries over:

- **Washed-out highlights.** Paper is the brightest value in the frame and
  nothing competes with it. Highlights bloom, they don't clip.
- **Deep, faded shadows.** Ink is a deep faded plum, never pure black, and
  never full contrast against paper.
- **Dense atmospheric mist.** Value separation between elements is soft.
  Nothing is crisply outlined; hierarchy comes from tone, not edges.
- **Heavy analog grain.** A fine, even grain sits over the whole
  composition — surfaces, fills and text — so no area reads as flat vector.
- **A quiet empty region.** The reference keeps a clean area of sky. That
  area is the text-safe zone: headlines land in open, low-detail space.

What does not carry over: literal scenery, literal fog textures as
backgrounds, and any literal teal/cyan. The brief named a monochromatic
deep-cyan and faded-pale-teal combination as the image's palette; this
document translates that intent into Edityy's own rose-and-plum palette.
The *grade* transfers, the *hue* is the app's own.

## Colors

Warm paper under plum ink, with a rose mid-tone doing the signalling.

- **Primary (#3a283c):** Deep plum ink. Headlines, body text, the primary
  button, the orb. Never pure black.
- **Secondary (#86546b):** Dusty rose-brown. Dark surfaces, hover fills,
  muted-on-dark emphasis. Also the muted text color on light fills.
- **Tertiary (#b6758b):** Mid rose. Signal dots, active states,
  interaction highlights — always paired with ink or paper text.
- **Neutral (#f9f2ee):** Warm paper. The canvas and editor background,
  softer than pure white. The app's brightest value.
- **Surface (#f9f2ee):** Cards and instruction blocks sit on the same
  paper as the canvas, separated only by a hairline and by grain. Layers
  that need to lift off the canvas use a blur, not a lighter fill.
- **On-primary (#f9f2ee):** Text and icons on plum fills.
- **Muted (#86546b):** Secondary copy, timestamps, captions on paper.
- **Border (#3a283c1a):** Hairline dividers between panes — ~10% ink.
  Slightly heavier than a typical hairline, because grain eats contrast.
- **Accent-rose (#d79eac) / Accent-blush (#ecc5c9):** Pastel badges for
  content state (draft / review / published), always with ink text.

The ramp runs paper → blush → rose → mid rose → plum. There is no sixth
value, and nothing is pure white or pure black.

## Typography

The ramp is carried by weight as well as size:

- **Page title (2.75rem / 600 / -1.76px):** one per view, set in open,
  low-detail space.
- **Section and card title (1rem / 600 / -0.02em):** panels and lists.
- **Body-md (1rem / 400):** paragraphs and agent instructions, max ~35rem
  measure.
- **Label (0.875rem / 500):** form-field names, plus buttons, nav links
  and badges.

Body and meta text is 400, a name or an action is 500, a heading is 600.
Those three weights are exactly what is shipped — the site loads Plus
Jakarta Sans 400/500/600 (Latin subset) from `app/fonts` via
`next/font/local`, because `next/font/google` fetches at build time and
fails on restricted networks.

The design calls for Nohemi as a display face (hero statements, wordmark,
page titles) over Plus Jakarta Sans for everything else. Nohemi is not
loaded yet; page titles currently set in Plus Jakarta Sans 600. Bundle it
the same way — the files under `app/fonts`, wired through
`next/font/local` — when the brand needs its own display type.

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
layers. Base UI gets depth from layering paper tones and grain, not
shadows — editor cards sit on Surface with a hairline border and no
shadow. Floating layers lift with a diffuse outer shadow
(`0 1px 1px + 0 6px 12px` at ~5–10% ink) plus backdrop blur. Dark panels
invert: paper text on Primary with paper hairlines.

## Shapes

Small radii on UI, large on content cards. Buttons 8px, inputs 8px,
status badges and signal dots fully pill (28px), editor cards 12–16px.
Divider ticks 2px. The orb is fully round. Never square buttons, never
over-round cards into bubbles.

## Components

- **Primary button:** plum fill, paper label, 8px radius, `0.75rem 1rem`
  padding, flex with 0.5rem gap. Hover steps to Secondary.
- **Secondary button:** paper fill at ~75% opacity with blur over dark,
  ink label, same radius.
- **Card:** Surface fill, ink text, 12px radius, 24px padding, hairline
  border. Used for editor panels and agent-instruction blocks.
- **Muted section:** Neutral fill, ink text, 16px radius, 40px padding.
- **Input:** paper fill, ink text, 8px radius. Used for content fields
  in the editor.
- **Badges:** pastel fill (rose / blush), ink text, pill radius. Used for
  content state.
- **Divider:** border-ink 1px line. **Signal dots:** 12px pills in mid rose
  for agent/sync status, decorative only.
- **Orb:** a single filled circle, Primary, bottom-right, persistent.
  Its only job is to be the thing you press to reveal more.
- **Floating layer:** translucent paper with backdrop blur, rounded
  `xl`, anchored to the orb's position. One depth level per layer.

## Texture

A fine grain overlay sits above the canvas and below text, at low
opacity, across every surface. It is what makes the palette read as
graded rather than picked. Keep it subtle enough that body text stays
legible and it never appears as a repeating tile at a fixed scale.

## Do's and Don'ts

- Do give each view one display-sized title, placed in open space, and set
  every other heading in semibold; do not reintroduce Geist or a system
  serif.
- Do keep editor copy on paper with ink text; don't put body copy on rose
  or pastel fills.
- Do use paper text only on plum and rose-brown; don't place paper text
  on rose or blush (fails contrast).
- Do use pastels with ink text for content-state badges; don't use them
  for buttons.
- Do let interaction layers blur and float; don't add gradients to
  buttons or panels.
- Do keep the orb the single entry point; don't spread controls across a
  permanent toolbar.
- Don't introduce pure black, pure white, or a new hue — the ramp is
  five values and it is closed.