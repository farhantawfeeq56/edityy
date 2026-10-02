/*
 * Edityy V1 launcher.
 *
 * Drop this into ANY localhost app with one tag, no npm package, no build step:
 *
 *   <script src="http://localhost:3000/edityy.js" defer></script>
 *
 * It mounts a launcher in the page's own document, so the site keeps running
 * exactly as it was — this file only adds a button.
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

  // Shadow DOM, so the site's CSS (button resets, font rules, z-index wars)
  // cannot reach the launcher, and the launcher cannot leak styles out.
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
