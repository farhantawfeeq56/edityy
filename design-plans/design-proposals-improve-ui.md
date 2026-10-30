# Design proposals

Written against `0672681`, with the uncommitted landing refresh in the working tree.

An audit of the two design surfaces Edityy ships: the public site (`/` and `/docs`) and the
editor chrome inside `packages/edityy`. Each proposal below is a change to presentation. None of
them changes behaviour.

Read this first, because everything else depends on it.

## The design document is stale

`DESIGN.md` is the binding contract, and it describes a cobalt-and-navy ramp with Plus Jakarta
Sans titles. The working tree replaces that ramp with warm paper and gold, and adds a serif
display face. The chrome was moved to the new values too, and its own source comment now cites
`DESIGN.md` for values `DESIGN.md` does not contain.

So the document and the code disagree, and no finding below rests on which one wins. Decide that
first: update `DESIGN.md` to the new ramp, or revert the tokens. Until then, the palette cannot be
audited, and the proposals below are limited to things that are wrong under either ramp.

---

## Site

### 1. The feature tile's hover lift does not animate

The tile asks for two transitions at once. Only one of them applies, and it is the one that does
not carry `transform`. So the 2px rise snaps into place while the colour change eases.

Give the tile one transition owner that carries both position and colour.

This is the clearest defect in the audit: a documented pointer answer that never runs.

### 2. The sticky header changes colour for readers who ask for less motion

The header's background is written in two places: a class on the element, and a scroll animation
in the stylesheet. The animation only runs when motion is welcome and the browser supports
scroll-driven animation. Everyone else sees the class.

So the header is warm paper for most readers and plain white for the ones who asked for less
motion. Reduced motion should remove movement, never change a colour.

Make the element's own background the same value the animation starts from.

### 3. The docs sidebar label is the only one of its kind

Three places write the same small uppercase group label. Two follow one style, the docs sidebar
follows another: different typeface, different weight, different tracking. The stylesheet already
names the correct one as a utility, and nothing uses it.

Point the docs sidebar label at that utility.

### 4. Two shadows use a colour that is no longer in the ramp

The sticky header and the install chip hand-write their shadows tinted with the retired navy.
Nothing else in the codebase uses that colour. The stylesheet already has one owner for a floating
surface's shadow, and it uses the current ink.

Let both shadows take their colour from that owner.

### 5. Every button on the site is a pill

`DESIGN.md` says buttons take an 8px radius, and reserves the pill for badges and signal dots. The
nav *bar* is the pill, not the controls inside it. The site makes every control a pill, and the
chrome's own primary button is 8px — so the two surfaces disagree about what a button is.

Give site buttons the documented radius and keep the pill for badges, dots and the bar itself.

This one is a judgement call. The site has looked like this for a while, so treat it as a
question, not a correction.

---

## Editor chrome

### 6. The Edits button marks itself open differently from every other button

A dock button that is open wears a warm wash and a hairline ring. The Edits button, which is the
same kind of button with the same attribute, overrides that with the near-white fill the *text
fields* use. So one open control reads as a field and the rest read as open controls.

Remove the override so the Edits button inherits the open mark. The colour button makes the same
mistake and wants the same treatment.

### 7. A chosen row and a hovered row look the same

In the dropdown lists, hover and chosen are one declaration. A reader cannot tell which row is
already picked. The other two list rows in the chrome do this correctly: they add a ring for the
chosen one and keep hover quiet.

Give the chosen row that ring and leave hover as the quiet ink step.

### 8. The keyboard ring has three styles and six controls have none

Most controls draw one ring: a paper gap and an accent outline. The launcher draws a plain ink
outline instead. And the controls a reader actually tabs through most — the option rows, the
dropdown rows, the side links, the dismiss button, the primary button — draw nothing of their
own, so they fall back to the browser's ring inside the shadow root.

One ring, declared once, on every control a keyboard can reach. The launcher joins it.

This is the cheapest high-value fix in the document.

### 9. The press has five different amounts

The timing is shared properly from one token, and that part is right. The distance is not: some
controls press to 94%, some 96%, some 97%, some 98%, and the primary button moves down instead of
scaling. `DESIGN.md` says every control that answers the pointer presses the same way.

Put one amount on the shared press rule and delete the nine local ones. 98% is the value most
controls already use.

---

## Found, then dropped

- The chrome reads a brand variable that the site never sets. Nothing renders differently today,
  because the fallback equals the token. That is wiring, not presentation.
- The site has no designed focus ring anywhere. Real, but that is accessibility, a separate issue.
- Two list rows use different hover fills, and the chrome's radii drift from the documented set
  (7 and 10px on the dock against 4/8/12/16/28). Both are real, but neither has a documented
  contract to correct against, or the fix is a rework rather than a fix.
- The site ships twelve type sizes where the document names four. Same reason as above, and the
  document is stale anyway.
- The docs headings never followed the landing page into the display face. Visible in the diff,
  but either the code or the document could change, so it is not a finding.

## Suggested order

Start with 8, then 1. Both are small, both are unambiguous, and both fix something a reader runs
into on every visit. 6 and 7 are the same root as each other and can ship together. 5 and the
`DESIGN.md` decision need your call before anyone writes code.
