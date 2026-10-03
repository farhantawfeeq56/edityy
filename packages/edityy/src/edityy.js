/*
 * Edityy launcher — the payload this package serves.
 *
 * Runs inside the page it is injected into, and mounts one launcher button:
 * a fixed, full-viewport host that ignores pointer events, an open shadow root
 * so the host page's CSS cannot reach the launcher (and the launcher cannot
 * leak styles back out), and a single button in the bottom-right corner.
 *
 * Clicking dispatches `edityy:launcher-click` on window — the seam an editor
 * panel uses to talk to the page — and logs to the console.
 *
 * Browser IIFE on purpose: this file is served to the page as-is, so it cannot
 * be a module.
 */
(function () {
  "use strict";

  if (window.__edityy) return; // a shared layout can render the tag more than once
  window.__edityy = true;

  var host = document.createElement("div");
  host.setAttribute("data-edityy", "");
  // A full-viewport host that ignores pointer events: it can grow into a panel
  // later without ever coming between the user and the site.
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none";

  var root = host.attachShadow({ mode: "open" });
  root.innerHTML = [
    "<style>",
    ":host{all:initial}",
    "*{box-sizing:border-box}",
    "button{position:fixed;right:24px;bottom:24px;width:56px;height:56px;",
    "border-radius:50%;border:0;margin:0;padding:0;cursor:pointer;pointer-events:auto;",
    "display:grid;place-items:center;font:600 15px/1 system-ui,sans-serif;color:#111;",
    "background:#b7efb2;box-shadow:0 6px 24px #1113}",
    "button:hover{opacity:.9}",
    "button:focus-visible{outline:2px solid #111;outline-offset:3px}",
    "</style>",
    '<button type="button" title="Edityy launcher (V1)" aria-label="Open Edityy">Edityy</button>',
  ].join("");

  root.querySelector("button").addEventListener("click", function () {
    // V1 has no editor. This event is the seam a later editor uses, so the page
    // can talk to an Edityy window without this file knowing how.
    window.dispatchEvent(new CustomEvent("edityy:launcher-click"));
    console.log("[edityy] launcher clicked — editor not built in V1");
  });

  (document.body || document.documentElement).appendChild(host);
})();