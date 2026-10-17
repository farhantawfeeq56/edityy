// The Edit text sweep: the Canvas UI ASCII sweep over one element, then gone.
//
// The launcher is plain JavaScript and has no React, so this file is bundled on
// its own (scripts/build-sweep.mjs) and loaded the first time a user chooses
// Edit text. It sets window.__edityySweep, which is the one thing the launcher
// reads, and it is imported by client.js in a project with a bundler.
//
// The sweep paints its two panels from markup it is given, so the element is
// copied into them rather than moved: the page's own element must stay where the
// framework put it. Both panels get the same copy, so what the band travels
// across is the element as it looks now, and the clone is a child of the
// element's parent, so the page's own selectors still reach it.
import { createElement, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import AsciiSweep from "./AsciiSweep";

/** One sweep, as options from the Canvas UI docs page. */
export type SweepOptions = Record<string, unknown>;

/** How long the overlay is allowed to live, whatever the effect does. */
const SAFETY_MS = 4000;

/** WebGL2 is what the effect draws with. No context, no sweep. */
function canSweep(): boolean {
  try {
    const probe = document.createElement("canvas");
    return !!probe.getContext("webgl2");
  } catch {
    return false;
  }
}
/**
 * The box an absolutely positioned child of this element lands in: the nearest
 * ancestor that is positioned, or the document when there is none. Walking this
 * is what lets the overlay be placed without giving the page's own element a
 * `position` it never had.
 */
function containingBlock(el: HTMLElement): HTMLElement | null {
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    if (getComputedStyle(node).position !== "static") return node;
  }
  return null;
}

/** The panel: the copied markup, as HTML, as React wants it. */
function panel(html: string): ReactNode {
  return createElement("div", { dangerouslySetInnerHTML: { __html: html } });
}

/**
 * One sweep of an element, from its copy to the same copy: the ASCII band
 * crosses the element and the glow fades, and the element itself never moves.
 *
 * Starts on the first panel and turns to the second on the next frame, because
 * the turn is what starts the sweep.
 */
function Sweep({ html, options, onDone }: { html: string; options: SweepOptions; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIndex(1));
    return () => cancelAnimationFrame(frame);
  }, []);
  return createElement(
    AsciiSweep,
    {
      ...options,
      index,
      alternate: panel(html),
      onSweepEnd: onDone,
      // The size, always: every child of the effect's root is absolutely
      // positioned, so its height is otherwise zero and the whole sweep draws
      // into a one-pixel box.
      style: { width: "100%", height: "100%" },
    },
    panel(html),
  );
}

/**
 * Play the sweep over one element and answer when it has finished, so the caller
 * can put the caret in the element after it. Answers at once when the effect
 * cannot run: the caller treats that as "no sweep" and goes on.
 */
export function sweep(target: HTMLElement, options: SweepOptions): Promise<void> {
  const parent = target.parentElement;
  if (!parent || !document.body) return Promise.resolve();
  if (!canSweep()) {
    // Silence would leave the user wondering why nothing happened.
    console.warn("Edityy: no WebGL2 in this browser, so the Edit text sweep is skipped.");
    return Promise.resolve();
  }
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) return Promise.resolve();

  // The copy keeps the element's own margins, so the overlay is placed at the
  // margin box, not the border box: inside the panel the copy's margin cannot
  // collapse out the way it may have done on the page, and without this the
  // copy sits one margin lower than the element it stands in for. A margin of
  // `auto` reads back as its used value, so a centred element stays centred.
  const own = getComputedStyle(target);
  const margin = {
    top: parseFloat(own.marginTop) || 0,
    right: parseFloat(own.marginRight) || 0,
    bottom: parseFloat(own.marginBottom) || 0,
    left: parseFloat(own.marginLeft) || 0,
  };

  // The overlay goes in the element's own parent, because that is where the
  // page's styles for this markup are: a copy at the end of the body would lose
  // every rule that reaches through an ancestor. It is absolute, not fixed, so a
  // transformed ancestor cannot take it for a fixed box; the offsets are the
  // containing block's, which is the padding box of the nearest positioned
  // ancestor, or the document when the parent is static.
  const block = containingBlock(parent);
  const blockRect = block ? block.getBoundingClientRect() : { left: 0, top: 0 };
  const blockStyle = block ? getComputedStyle(block) : null;

  const overlay = document.createElement("div");
  overlay.setAttribute("data-edityy-sweep", "");
  // The copy is the effect, so it is never read out: the page's own element is
  // still right there underneath it.
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.cssText =
    "position:absolute;z-index:2147483646;pointer-events:none;overflow:hidden;" +
    "left:" + (rect.left - margin.left - blockRect.left - parseFloat(blockStyle?.borderLeftWidth || "0") + (block ? block.scrollLeft : window.pageXOffset)) + "px;" +
    "top:" + (rect.top - margin.top - blockRect.top - parseFloat(blockStyle?.borderTopWidth || "0") + (block ? block.scrollTop : window.pageYOffset)) + "px;" +
    "width:" + (rect.width + margin.left + margin.right) + "px;" +
    "height:" + (rect.height + margin.top + margin.bottom) + "px";
  parent.appendChild(overlay);

  // The copy keeps its own attributes, ids included: a page that styles this
  // element by id would otherwise show a differently painted copy, which is
  // worse than the duplicate id during the sweep. The overlay is up for about a
  // second and a half and holds one element.
  const html = target.outerHTML;
  const root = createRoot(overlay);
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      // Unmounting from inside a React callback is the one place React asks
      // callers not to do it, so the whole teardown waits a turn.
      setTimeout(() => {
        root.unmount();
        overlay.remove();
        resolve();
      }, 0);
    };
    const timer = window.setTimeout(finish, SAFETY_MS);
    root.render(createElement(Sweep, { html, options, onDone: finish }));
  });
}

// What the launcher reads, whether this file was imported by client.js in a
// project with a bundler or fetched by the payload from the dev server.
window.__edityySweep = sweep;

declare global {
  interface Window {
    __edityySweep?: (target: HTMLElement, options: SweepOptions) => Promise<void>;
  }
}
