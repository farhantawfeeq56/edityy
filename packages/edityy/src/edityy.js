/*
 * Edityy — the payload this package serves.
 *
 * Runs inside the page it is injected into. Two layers:
 *
 * 1. A brand pill, fixed bottom-right in an open shadow root, so the host
 *    page's CSS cannot reach it and it cannot leak styles back out. It shows
 *    only the mark when the mode is off; clicking it dispatches
 *    `edityy:launcher-click` on window — the seam a host app can listen to —
 *    and opens the editing mode below. While the mode is on, the pill hides
 *    and the dock stands where it stood: one toolbar in the corner, never two.
 *
 * 2. A temporary editing mode. The pointer wears the toolbar's own
 *    paper while it is on, and Add draws with the precision point;
 *    hovering outlines an element, clicking selects it, and the
 *    actions open where it stands.
 *
 * Selecting an element opens its actions in a card at the element — Edit text,
 * Move, Parent, Child and Delete — and the style dock, fixed at the bottom
 * centre. An open control comes out over the dock. Text becomes editable only
 * after the user chooses Edit text; the control row changes styles and starts
 * with Text and Container options. A selected element also has type controls
 * and a `+` to add controls — shadow, fill, border, padding or margin.
 *
 * Every edit is an inline style: apply() writes it, remembers what was there,
 * and revert() puts it back on exit. The edits list hands them on — copied as a
 * prompt, or posted to the dev server, which writes them into the project for
 * a coding agent. Edityy itself never writes to the codebase, which stays the
 * source of truth.
 *
 * Browser IIFE on purpose: this file is served to the page as-is, so it cannot
 * be a module.
 */
(function () {
  "use strict";

  if (window.__edityy) return; // a shared layout can render the tag more than once
  window.__edityy = true;

  // The brand mark, served beside the payload. A URL, not a blob,
  // so the payload stays small and the file keeps one format.
  var LOGO = "/__edityy/logo.png";

  // The pointers, drawn not named, all at 16px to sit at the toolbar's own
  // scale, so one rule in the light DOM carries the canvas pointer. The
  // point is the bar's own paper in its ink stroke, and Add's precision
  // point is a cross to the ring at the middle of the square. The grip
  // keeps the browser's own hand: no custom drag pointer lives there.
  var POINTER_IMG = 'url("data:image/svg+xml,%3Csvg%20xmlns=\'http://www.w3.org/2000/svg\'%20width=\'16\'%20height=\'16\'%20viewBox=\'0%200%2024%2024\'%3E%3Cpath%20d=\'M4%202L20%2012L11.5%2014L9%2021Z\'%20fill=\'%23F9F8F6\'%20stroke=\'%2325241f\'%20stroke-width=\'1.5\'%20stroke-linejoin=\'round\'/%3E%3C/svg%3E")';
  var POINTER = POINTER_IMG + " 3 1, auto";
  var PRECISION = 'url("data:image/svg+xml,%3Csvg%20xmlns=\'http://www.w3.org/2000/svg\'%20width=\'16\'%20height=\'16\'%20viewBox=\'0%200%2024%2024\'%3E%3Cpath%20d=\'M12%202v6M12%2016v6M2%2012h6M16%2012h6\'%20stroke=\'%2325241f\'%20stroke-width=\'2\'%20stroke-linecap=\'round\'/%3E%3Ccircle%20cx=\'12\'%20cy=\'12\'%20r=\'3.5\'%20fill=\'%23F9F8F6\'%20stroke=\'%2325241f\'%20stroke-width=\'2\'/%3E%3C/svg%3E") 8 8, crosshair';

  var host = document.createElement("div");
  host.setAttribute("data-edityy", "");
  // A full-viewport host that ignores pointer events: the cursor and the frames
  // can grow over the site without ever coming between the user and the page.
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none";

  var root = host.attachShadow({ mode: "open" });

  // One icon family: Lucide (ISC), each glyph drawn on its own 24 grid inside the
  // 256 box the controls size their icons in. So a glyph is 18px wherever it
  // appears, and it brings no colour of its own: a control that paints itself dark
  // also paints its icon. A glyph is asked for by name from this table.
  var GLYPHS = {
    "align-center": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H3" /> <path d="M17 12H7" /> <path d="M19 19H5" /></svg>',
    "align-justify": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18" /> <path d="M3 12h18" /> <path d="M3 19h18" /></svg>',
    "align-left": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H3" /> <path d="M15 12H3" /> <path d="M17 19H3" /></svg>',
    "align-right": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H3" /> <path d="M21 12H9" /> <path d="M21 19H7" /></svg>',
    "arrow-down": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14" /> <path d="m19 12-7 7-7-7" /></svg>',
    "arrow-left": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7" /> <path d="M19 12H5" /></svg>',
    "arrow-right": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /> <path d="m12 5 7 7-7 7" /></svg>',
    "arrow-up": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7" /> <path d="M12 19V5" /></svg>',
    "baseline": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16" /> <path d="m6 16 6-12 6 12" /> <path d="M8 12h8" /></svg>',
    // A soft edge: a solid figure with its own halo. Blur wears it, so the drop
    // stays the mark of opacity alone.
    "blur": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.5" /> <circle cx="12" cy="12" r="8" opacity=".45" /></svg>',
    "chevron-up": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6" /></svg>',
    "check": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>',
    // A drop: how much of the element shows through, for opacity.
    "droplet": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" /></svg>',
    "bold": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" /></svg>',
    "columns-2": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /> <path d="M12 3v18" /></svg>',
    // A corner with a round bend: what a radius does to a box, and a shape of its
    // own, so the square stays the border's mark.
    "corner-radius": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V11a7 7 0 0 1 7-7h9" /></svg>',
    "ellipsis": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1" /> <circle cx="19" cy="12" r="1" /> <circle cx="5" cy="12" r="1" /></svg>',
    "expand": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 15 6 6" /> <path d="m15 9 6-6" /> <path d="M21 16v5h-5" /> <path d="M21 8V3h-5" /> <path d="M3 16v5h5" /> <path d="m3 21 6-6" /> <path d="M3 8V3h5" /> <path d="M9 9 3 3" /></svg>',
    "frame": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" x2="2" y1="6" y2="6" /> <line x1="22" x2="2" y1="18" y2="18" /> <line x1="6" x2="6" y1="2" y2="22" /> <line x1="18" x2="18" y1="2" y2="22" /></svg>',
    "grip": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1" /> <circle cx="19" cy="5" r="1" /> <circle cx="5" cy="5" r="1" /> <circle cx="12" cy="12" r="1" /> <circle cx="19" cy="12" r="1" /> <circle cx="5" cy="12" r="1" /> <circle cx="12" cy="19" r="1" /> <circle cx="19" cy="19" r="1" /> <circle cx="5" cy="19" r="1" /></svg>',
    "italic": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" x2="10" y1="4" y2="4" /> <line x1="14" x2="5" y1="20" y2="20" /> <line x1="15" x2="9" y1="4" y2="20" /></svg>',
    "layers": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" /> <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" /> <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" /></svg>',
    "layout-grid": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1" /> <rect width="7" height="7" x="14" y="3" rx="1" /> <rect width="7" height="7" x="14" y="14" rx="1" /> <rect width="7" height="7" x="3" y="14" rx="1" /></svg>',
    "link": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /> <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>',
    "list": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h.01" /> <path d="M3 12h.01" /> <path d="M3 19h.01" /> <path d="M8 5h13" /> <path d="M8 12h13" /> <path d="M8 19h13" /></svg>',
    "maximize": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3" /> <path d="M21 8V5a2 2 0 0 0-2-2h-3" /> <path d="M3 16v3a2 2 0 0 0 2 2h3" /> <path d="M16 21h3a2 2 0 0 0 2-2v-3" /></svg>',
    "message-square": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" /></svg>',
    "sparkles": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" /><path d="M20 2v4" /><path d="M22 4h-4" /><circle cx="4" cy="20" r="2" /></svg>',
    "move": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20" /> <path d="m15 19-3 3-3-3" /> <path d="m19 9 3 3-3 3" /> <path d="M2 12h20" /> <path d="m5 9-3 3 3 3" /> <path d="m9 5 3-3 3 3" /></svg>',
    "move-diagonal": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 19H5v-6" /> <path d="M13 5h6v6" /> <path d="M19 5 5 19" /></svg>',
    "move-horizontal": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 8 4 4-4 4" /> <path d="M2 12h20" /> <path d="m6 8-4 4 4 4" /></svg>',
    "move-vertical": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20" /> <path d="m8 18 4 4 4-4" /> <path d="m8 6 4-4 4 4" /></svg>',
    "paint-bucket": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z" /> <path d="m5 2 5 5" /> <path d="M2 13h15" /> <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z" /></svg>',
    "pencil": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /> <path d="m15 5 4 4" /></svg>',
    "pipette": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 22 1-1h3l9-9" /> <path d="M3 21v-3l9-9" /> <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.6.6a1 1 0 0 1 0 1.4l-1 1a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4l1-1a1 1 0 0 1 1.4 0z" /></svg>',
    "plus": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /> <path d="M12 5v14" /></svg>',
    "minus": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /></svg>',
    "rows-2": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /> <path d="M3 12h18" /></svg>',
    "square": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /></svg>',
    "strikethrough": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4H9a3 3 0 0 0-2.83 4" /> <path d="M14 12a4 4 0 0 1 0 8H6" /> <line x1="4" x2="20" y1="12" y2="12" /></svg>',
    "trash-2": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11v6" /> <path d="M14 11v6" /> <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /> <path d="M3 6h18" /> <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>',
    "type": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16" /> <path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" /> <path d="M9 20h6" /></svg>',
    "underline": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v6a6 6 0 0 0 12 0V4" /> <line x1="4" x2="20" y1="20" y2="20" /></svg>',
    "undo-2": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5" /> <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" /></svg>',
    "unlink": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71" /> <path d="m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71" /> <line x1="8" x2="8" y1="2" y2="5" /> <line x1="2" x2="5" y1="8" y2="8" /> <line x1="16" x2="16" y1="19" y2="22" /> <line x1="19" x2="22" y1="16" y2="16" /></svg>',
    "unfold-horizontal": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 12h6" /> <path d="M8 12H2" /> <path d="M12 2v2" /> <path d="M12 8v2" /> <path d="M12 14v2" /> <path d="M12 20v2" /> <path d="m19 15 3-3-3-3" /> <path d="m5 9-3 3 3 3" /></svg>',
    "square-plus": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M8 12h8" /><path d="M12 8v8" /></svg>',
    "scroll-text": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 12h-5" /> <path d="M15 8h-5" /> <path d="M19 17V5a2 2 0 0 0-2-2H4" /> <path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" /></svg>',
    "square-text": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /> <path d="M7 8h10" /> <path d="M7 12h10" /> <path d="M7 16h6" /></svg>',
    "x": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /> <path d="m6 6 12 12" /></svg>',
    "wrap-text": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16-3 3 3 3" /> <path d="M3 12h14.5a1 1 0 0 1 0 7H13" /> <path d="M3 19h6" /> <path d="M3 5h18" /></svg>',
  };

  var svg = function (name) {
    // A name from GLYPHS, or markup that is already drawn: the alignment grid
    // composes its own frame and dot, and is handed over as it is.
    var glyph = GLYPHS[name] || name;
    return '<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">' + glyph + "</svg>";
  };
  // Tabler (MIT): each tool ships a true filled twin. The outline wears the
  // tool at rest, the filled glyph wears it when the tool is on.
  var TOOL_FAMILIES = {
    tabler: {
      comment: { outline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20l1.3 -3.9c-2.324 -3.437 -1.426 -7.872 2.1 -10.374c3.526 -2.501 8.59 -2.296 11.845 .48c3.255 2.777 3.695 7.266 1.029 10.501c-2.666 3.235 -7.615 4.215 -11.574 2.293l-4.7 1" /></svg>',
        filled: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.821 4.91c3.899 -2.765 9.468 -2.539 13.073 .535c3.667 3.129 4.168 8.238 1.152 11.898c-2.841 3.447 -7.965 4.583 -12.231 2.805l-.233 -.101l-4.374 .931l-.04 .006l-.035 .007h-.018l-.022 .005h-.038l-.033 .004l-.021 -.001l-.023 .001l-.033 -.003h-.035l-.022 -.004l-.022 -.002l-.035 -.007l-.034 -.005l-.016 -.004l-.024 -.005l-.049 -.016l-.024 -.005l-.011 -.005l-.022 -.007l-.045 -.02l-.03 -.012l-.011 -.006l-.014 -.006l-.031 -.018l-.045 -.024l-.016 -.011l-.037 -.026l-.04 -.027l-.002 -.004l-.013 -.009l-.043 -.04l-.025 -.02l-.006 -.007l-.056 -.062l-.013 -.014l-.011 -.014l-.039 -.056l-.014 -.019l-.005 -.01l-.042 -.073l-.007 -.012l-.004 -.008l-.007 -.012l-.014 -.038l-.02 -.042l-.004 -.016l-.004 -.01l-.017 -.061l-.007 -.018l-.002 -.015l-.005 -.019l-.005 -.033l-.008 -.042l-.002 -.031l-.003 -.01v-.016l-.004 -.054l.001 -.036l.001 -.023l.002 -.053l.004 -.025v-.019l.008 -.035l.005 -.034l.005 -.02l.004 -.02l.018 -.06l.003 -.013l1.15 -3.45l-.022 -.037c-2.21 -3.747 -1.209 -8.391 2.413 -11.119z" /></svg>' },
      add: { outline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c7.2 0 9 1.8 9 9c0 7.2 -1.8 9 -9 9c-7.2 0 -9 -1.8 -9 -9c0 -7.2 1.8 -9 9 -9" /> <path d="M15 12h-6" /> <path d="M12 9v6" /></svg>',
        filled: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l.324 .001l.318 .004l.616 .017l.299 .013l.579 .034l.553 .046c4.785 .464 6.732 2.411 7.196 7.196l.046 .553l.034 .579c.005 .098 .01 .198 .013 .299l.017 .616l.005 .642l-.005 .642l-.017 .616l-.013 .299l-.034 .579l-.046 .553c-.464 4.785 -2.411 6.732 -7.196 7.196l-.553 .046l-.579 .034c-.098 .005 -.198 .01 -.299 .013l-.616 .017l-.642 .005l-.642 -.005l-.616 -.017l-.299 -.013l-.579 -.034l-.553 -.046c-4.785 -.464 -6.732 -2.411 -7.196 -7.196l-.046 -.553l-.034 -.579a28.058 28.058 0 0 1 -.013 -.299l-.017 -.616c-.003 -.21 -.005 -.424 -.005 -.642l.001 -.324l.004 -.318l.017 -.616l.013 -.299l.034 -.579l.046 -.553c.464 -4.785 2.411 -6.732 7.196 -7.196l.553 -.046l.579 -.034c.098 -.005 .198 -.01 .299 -.013l.616 -.017c.21 -.003 .424 -.005 .642 -.005zm0 6a1 1 0 0 0 -1 1v2h-2l-.117 .007a1 1 0 0 0 .117 1.993h2v2l.007 .117a1 1 0 0 0 1.993 -.117v-2h2l.117 -.007a1 1 0 0 0 -.117 -1.993h-2v-2l-.007 -.117a1 1 0 0 0 -.993 -.883z" fill="currentColor" /></svg>' },
      edits: { outline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4" /> <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2" /> <path d="M9 17h6" /> <path d="M9 13h6" /></svg>',
        filled: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l.117 .007a1 1 0 0 1 .876 .876l.007 .117v4l.005 .15a2 2 0 0 0 1.838 1.844l.157 .006h4l.117 .007a1 1 0 0 1 .876 .876l.007 .117v9a3 3 0 0 1 -2.824 2.995l-.176 .005h-10a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-14a3 3 0 0 1 2.824 -2.995l.176 -.005zm3 14h-6a1 1 0 0 0 0 2h6a1 1 0 0 0 0 -2m0 -4h-6a1 1 0 0 0 0 2h6a1 1 0 0 0 0 -2" /> <path d="M19 7h-4l-.001 -4.001z" /></svg>' },
    },

  };

  /** The toolbar glyph for a tool: the trial outline at rest, its filled twin when on. */
  function toolSvg(key, glyph, pressed) {
    var pair = TOOL_FAMILIES.tabler[key];
    if (!pair) return svg(glyph);
    return '<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">' + (pressed ? pair.filled : pair.outline) + "</svg>";
  };

  // The motion tokens. The values live in src/motion.css, which the site
  // imports, so the site and the chrome run on the same timings. The chrome
  // carries the same values as a fallback, because it runs inside a shadow
  // root on somebody else's page and cannot read that file.
  // test/motion.test.js holds the two copies together.
  //
  // A curve, and what it is for. Arrive is a long ease-out, so the way in is
  // felt. Leave is a short ease-in, so the way out is not waited for. Standard
  // is the even curve for a value under the pointer. Travel carries the orb's
  // shrink and its journey in one move. Breathe is the only one that never
  // arrives: it is the loop that says "waiting".
  var EASE = {
    arrive: "cubic-bezier(0.23, 1, 0.32, 1)",
    leave: "cubic-bezier(0.4, 0, 1, 1)",
    standard: "cubic-bezier(0, 0, 0.2, 1)",
    travel: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    breathe: "ease-in-out"
  };
  // A duration, and what it is for. Press goes down fast, because the hand is
  // quick, and comes back slow, because the release settles. Fade is a short
  // disappearance. Tint is a colour change. Slide is a value moving under the
  // pointer. Settle is a value coming to rest. Enter is a surface arriving.
  // Rise is a surface rising, or a long journey across the dock. Move is the
  // orb's own journey. Pulse is the waiting loop.
  var TIME = {
    press: 80,
    fade: 120,
    tint: 130,
    slide: 150,
    settle: 200,
    enter: 220,
    rise: 260,
    move: 300,
    pulse: 1400
  };
  var EASE_NAMES = ["arrive", "leave", "standard", "travel", "breathe"];
  var TIME_NAMES = ["press", "fade", "tint", "slide", "settle", "enter", "rise", "move", "pulse"];
  // The tokens the chrome wears. Each one reads the page's own token first and
  // falls back to the value here, so a page that sets --edityy-* on :root gets
  // its own timing and a page that sets nothing gets the chrome's.
  // Custom properties are not reset by all:initial.
  var hostTokens = ":host{";
  EASE_NAMES.forEach(function (name) {
    hostTokens += "--" + name + ":var(--edityy-ease-" + name + "," + EASE[name] + ");";
  });
  TIME_NAMES.forEach(function (name) {
    hostTokens += "--" + name + ":var(--edityy-" + name + "," + TIME[name] + "ms);";
  });
  hostTokens += "}";
  // The tokens, for a page that wants to read them.
  window.__edityyMotion = { ease: EASE, time: TIME };

  // DESIGN.md is the source of truth for the values below: Ink #f5f2e9,
  // Paper #22211c, Muted #a8a294, hairline #f5f2e91a, Brand gold #d4a72c for
  // a fill, Brand bronze #e9c766 for a ring or a word, and Brand soft #2c2817
  // for the control the user has open. The ramp is closed. The ramp has no
  // second neutral, so a control that needs a fill on paper wears ink alpha
  // (the ink 6% below), never a grey.
  //
  // Gold is never a thin line on paper: #d4a72c is 2.1:1 there. It is a fill
  // with ink on it, and --accent carries the lighter bronze that reads as a
  // ring on dark paper.
  //
  // The sheet paints itself from the variables on the first :host rule, so a
  // page that sets --edityy-ink and its neighbours repaints the whole chrome.
  // Every one of them falls back to its DESIGN.md value.
  root.innerHTML = [
    "<style>",
    // all:initial and the colour on ONE rule: a second :host{color} later in the
    // sheet would win, but `all:initial` resets colour itself, so a :host{color}
    // written before it is wiped and every icon goes back to its own ink.
    ":host{all:initial;color:var(--ink)}",
    // The motion, in one rule, so no animation in the chrome can invent a
    // duration or a curve of its own.
    hostTokens,
    "*{scrollbar-width:thin;scrollbar-color:var(--ink-25) transparent}",
    "*::-webkit-scrollbar{width:6px;height:6px}",
    "*::-webkit-scrollbar-track{background:transparent}",
    "*::-webkit-scrollbar-thumb{background:var(--ink-25);border-radius:6px}",
    "*::-webkit-scrollbar-thumb:hover{background:var(--ink-40)}",
    // The five values, and the steps drawn from them. The numbers on an ink or
    // a rose step are its alpha percentage: colour-mix against transparent
    // keeps the alpha and the colour, so a step holds whatever the ink is.
    ":host{--ink:var(--edityy-ink,#f5f2e9);--paper:var(--edityy-paper,#22211c);--muted:var(--edityy-muted,#a8a294);",
    "--accent:var(--edityy-accent,#e9c766);--rose:var(--edityy-rose,#6b5a1e);",
    // The fill of the control the user has open, and of the row that is chosen:
    // warm, because the open control is the one thing on the bar that is not paper.
    "--accent-soft:var(--edityy-accent-soft,#2c2817);--brand:var(--edityy-brand,#d4a72c);--surface:var(--edityy-surface,#2a2924);--on-brand:var(--edityy-on-brand,#1a1915);",
    "--ink-4:color-mix(in srgb,var(--ink) 4%,transparent);--ink-6:color-mix(in srgb,var(--ink) 6%,transparent);",
    "--ink-8:color-mix(in srgb,var(--ink) 8%,transparent);--ink-10:color-mix(in srgb,var(--ink) 10%,transparent);",
    "--ink-12:color-mix(in srgb,var(--ink) 12%,transparent);--ink-15:color-mix(in srgb,var(--ink) 15%,transparent);",
    "--ink-20:color-mix(in srgb,var(--ink) 20%,transparent);--ink-25:color-mix(in srgb,var(--ink) 25%,transparent);",
    "--ink-35:color-mix(in srgb,var(--ink) 35%,transparent);--ink-40:color-mix(in srgb,var(--ink) 40%,transparent);",
    "--rose-30:color-mix(in srgb,var(--rose) 30%,transparent);--rose-40:color-mix(in srgb,var(--rose) 40%,transparent);",
    "--paper-88:color-mix(in srgb,var(--paper) 88%,transparent);",
    // A control that is open, and one under the pointer: paper stepped once
    // towards ink, so the step holds whatever the paper is.
    "--fill-open:color-mix(in srgb,var(--ink) 3%,var(--paper));--fill-hover:color-mix(in srgb,var(--ink) 1%,var(--paper))}",
    // `all:initial` severs inheritance, so the payload names a font itself. The
    // chrome wears Plus Jakarta Sans, the Edityy face. A page that keeps its
    // copy behind a hashed name (next/font does) names it once on --edityy-font,
    // and the chrome picks it up: custom properties cross the shadow boundary.
    // The machine own UI face is the floor, and no webfont loads here.
    //
    // The colour goes on :host, not on *. A universal colour reaches the <path>
    // inside an icon as well as its <svg>, and since those paths are painted with
    // currentColor they resolve against their OWN colour — which is this ink on
    // every button. An open control paints itself var(--ink), so its icon was the
    // same colour as its own background: invisible. On :host it is inherited
    // down to the button and stops there.
    "*{box-sizing:border-box;font-family:var(--edityy-font,\"Plus Jakarta Sans\"),system-ui,-apple-system,\"Segoe UI\",Roboto,sans-serif}",
    "[hidden]{display:none!important}", // also for #dock, whose display:flex would beat it
    // The dock is one surface in one place: fixed at the bottom right, where
    // the brand pill stood, whatever the element and the page do. A column,
    // because an open control comes out over the icon row. As wide as its row,
    // up to the viewport less a 12px margin on the left. The grip moves it by
    // writing its left and top inline, over this corner, until exit clears them.
    "#dock{position:fixed;right:24px;bottom:24px;z-index:3;pointer-events:auto;",
    "width:max-content;max-width:calc(100vw - 100px);display:flex;flex-direction:column;align-items:center}",
    // The grip is the toolbar's first segment, not a separate pill: it floats
    // over the bar's left edge, so the bar widens left to show it while the
    // tools stand exactly where they were. At rest it takes no space and the
    // toolbar is its old self; hidden, it is still one rounded pill.
    ".grip{position:absolute;left:0;top:0;bottom:0;width:0;display:grid;place-items:center;margin:0;",
    "padding:0;border:0;overflow:hidden;border-radius:10px 0 0 10px;",
"background:transparent;color:var(--muted);cursor:grab;touch-action:none;opacity:0;pointer-events:none;",
    "transition:width var(--slide) var(--arrive),opacity var(--tint) var(--standard)}",
    "#dock:hover .grip,.grip:focus-visible{width:30px;opacity:1;pointer-events:auto}",
    ".grip:active{cursor:grabbing}",
    ".grip:focus-visible{outline:2px solid var(--accent);outline-offset:1px}",
    ".grip>svg{width:16px;height:16px;display:block;color:inherit}",
    // A solid white surface. Depth comes from the shadow, not an edge: the
    // hairline it used to carry made it read as a card laid on the page.
    // A row wider than the viewport wraps onto a second line, so every control
    // stays on screen; it does not scroll, which would clip the lists that come
    // up out of its controls.
    ".row{position:relative;display:flex;flex-wrap:wrap;min-width:0;gap:2px;padding:3px;min-height:38px;align-items:center;background:transparent;border:0;border-radius:10px;",
    "box-shadow:none}",
    // The close chip: half on the dock's top-right corner, half out, so it
    // reads as the corner's own tab and not a fifth tool in the row. Black
    // fill, round. It shows only on a hover over the bar or the warm zone
    // around it, so it never waits for a hover first and never drops while
    // the pointer crosses to it.
    ".dock-close{position:absolute;top:-10px;right:-10px;z-index:2;width:20px;height:20px;border-radius:999px;border:0;padding:0;display:grid;place-items:center;background:#000;color:var(--ink);cursor:pointer;opacity:0;pointer-events:none;transform:scale(.5);transform-origin:center;transition:transform var(--tint) var(--standard),opacity var(--tint) var(--standard);box-shadow:0 1px 2px var(--ink-6)}",
    ".dock-close:hover{background:#000;color:#fff}",
    "#dock:hover .dock-close,#dock.dock-warm .dock-close,.dock-close:focus-visible{opacity:1;pointer-events:auto;transform:scale(1)}",
    ".dock-close:focus-visible{outline:2px solid var(--accent);outline-offset:1px}",
    ".dock-close>svg{width:11px;height:11px;display:block;color:inherit}",
    // One hover fill for the whole row, not one per icon: it travels from the
    // control the pointer left to the one it is on, so the eye follows a single
    // thing instead of watching fills blink on and off. A pseudo-element, so it
    // is never one of row.children. It fades in where it first lands, and moves
    // only once it is on show (data-glide=warm). It goes down a line with the
    // control when the row wraps.
    ".row:before{content:\"\";position:absolute;left:0;top:0;height:var(--glide-h,32px);width:var(--glide-w,32px);border-radius:7px;",
    "background:var(--ink-6);pointer-events:none;opacity:0;transform:translate(var(--glide-x,0px),var(--glide-y,3px));transition:opacity var(--fade) var(--arrive)}",
    ".row[data-glide]:before{opacity:1;transition:opacity var(--fade) var(--arrive)}",
    ".row[data-glide=warm]:before{transition:opacity var(--fade) var(--arrive),transform var(--slide) var(--arrive)}",
    ".row>*{position:relative}",
    "@media (hover:hover){.row .ic:hover{background:transparent}}",
    // The row of the mode that is left, kept in place while the new one takes
    // over. It is the controls that cross over, so its box is not drawn: two
    // edges and two shadows moving at once would read as two toolbars.
    ".row.still{box-shadow:none;border-color:transparent;background:transparent}",
    // Icons: Lucide, in the ramp, on a light fill when their control is open, so
    // what is open is obvious without a label.
    // A 1px transparent border, so a control can take a border colour when it is
    // open without moving its icons a pixel.
    ".ic{width:32px;height:32px;display:grid;place-items:center;border:1px solid transparent;padding:0;",
    "border-radius:7px;background:transparent;color:var(--muted);cursor:pointer;opacity:.8}",
    "@media (hover:hover){.ic:hover{background:var(--ink-6);color:var(--ink);opacity:1}}",
    ".ic[aria-pressed=true]{opacity:1;background:var(--paper);box-shadow:inset 0 0 0 1px var(--ink-12)}",
    ".ic[aria-pressed=true]:before{content:\"\";position:absolute;inset:8px;background:#F2F2F2;border-radius:4px;pointer-events:none}",
    ".ic[aria-pressed=true]>svg{position:relative;color:var(--ink)}",
    // The toolbar is one segmented control: three icons, and the one that is
    // on wears the hover fill itself, so on and hover read as one language.
    // The filled icon is what says it is on: its shapes take the fill, so
    // the glyph turns solid while the background stays the hover colour.
    // The icon stays ink: paper on this fill would fail contrast.
    ".row>.ic[aria-pressed=true]{background:var(--ink-6);color:var(--ink);box-shadow:none;opacity:1;border-color:transparent}",
    ".row>.ic[aria-pressed=true]:before{display:none}",
    ".row>.ic[aria-pressed=true]>svg{color:var(--ink)}",
    // The keyboard stop wears the same accent ring the fields do: all:initial
    // takes the native ring away, and the glide fill alone is too faint to
    // mark the stop. Mouse clicks do not match focus-visible on buttons, so
    // the pointer keeps the fill alone.
    ".row>.ic:focus-visible{outline:2px solid var(--accent);outline-offset:1px}",
    // Numbered marks on changed elements and saved regions. One circle per
    // edit, drawn over the page where the edit is, never in its way.
    ".marks{position:fixed;inset:0;z-index:2;pointer-events:none}",
    ".marks .mark{position:absolute;display:grid;place-items:center;min-width:20px;height:20px;padding:0 5px;",
    "border-radius:999px;background:var(--ink);color:var(--paper);font:600 12px/20px inherit;pointer-events:none;",
    "transform:translate(-50%,-50%);box-shadow:0 1px 2px var(--ink-12)}",
    // The box the Add tool draws: a dashed frame while the pointer drags.
    ".region{position:fixed;z-index:2;border:1.5px dashed var(--ink);border-radius:2px;background:var(--ink-6);pointer-events:none}",
    // A control that joins the row arrives, so the row's edge is not the only
    // thing that moves.
    ".ic.arriving{animation:rowIn var(--enter) var(--arrive)}",
    "@keyframes rowIn{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:none}}",
    ".ic:disabled,.ic[aria-disabled=true]{opacity:.42;cursor:default;pointer-events:none}",
    ".ic.family-name{display:block;width:84px;max-width:84px;overflow:hidden;",
    "padding:0 6px;text-align:left;text-overflow:ellipsis;white-space:nowrap;font:500 13px/30px}",
    ".ic.group-start{margin-left:8px;position:relative}",
    ".ic.size-control{width:78px;display:flex;align-items:center;gap:2px;position:relative;padding:0 4px;",
    // The rectangle is there before the pointer arrives: a chip that holds a value
    // is a box, at rest and under the caret alike.
    "border:1px solid var(--ink-10)}",
    ".ic.size-control:focus-within{background:var(--fill-open)}",
    // A count the dock wears in its own row: the grid's columns × rows, and the
    // four offsets of an element that is placed absolutely.
    ".ic.dock-count{display:flex;align-items:center;gap:2px;width:auto;padding:0 6px;border:1px solid var(--ink-10)}",
    ".dock-count:focus-within{background:var(--fill-open)}",
    ".ic.dock-count input{width:4ch;height:28px;border:0;padding:0;background:transparent;color:inherit;",
    "font:500 13px/28px inherit;outline:none;text-align:center;font-variant-numeric:tabular-nums}",
    ".dock-count input::placeholder{color:var(--muted);opacity:1}",
    ".dock-count .times{color:var(--muted);font-family:inherit;font-size:12px;font-weight:500;line-height:1}",
    // A chip whose value can also be a word wears the list beside the figure: a
    // bare chevron in the chip, so the list is not a second box in the row.
    ".dock-count .custom-select{width:20px;flex:none;min-width:0}",
    ".dock-count .custom-select-trigger{border:0;padding:0;background:transparent;display:grid;place-items:center;width:100%;height:26px;color:var(--muted)}",
    ".dock-count .custom-select-trigger:hover{color:var(--ink)}",
    ".dock-count .custom-select-menu{left:auto;right:0;bottom:calc(100% + 6px);width:max-content;min-width:80px}",
    // The letter of an absolute side, so four numbers in a row still say which
    // side is which without a label over every one of them.
    ".dock-count .axis{margin-right:1px;color:var(--muted);font-family:inherit;font-size:9px;",
    "font-weight:500;line-height:1;letter-spacing:.04em}",
    ".ic.size-control input{width:44px;height:28px;border:0;padding:0;background:transparent;color:inherit;",
    "font:500 13px/28px inherit;outline:none;text-align:center;font-variant-numeric:tabular-nums}",
    ".custom-select{position:relative;flex:1;min-width:0}",
    ".custom-select-trigger{width:100%;border:1px solid var(--ink-10);border-radius:8px;padding:6px 8px;",
    "background:var(--paper);color:var(--ink);font:500 13px/1 inherit;text-align:left;cursor:pointer}",
    ".custom-select-trigger:hover{background:var(--fill-hover)}",
    ".custom-select-trigger:focus-visible{background:var(--fill-open);border-color:var(--muted)}",
    // A list that comes out of its control is a surface, and a surface
    // arrives. The same entrance the panel over the dock has, so the two
    // dropdowns in the chrome feel like one thing.
    ".custom-select-menu{position:absolute;left:0;right:0;bottom:calc(100% + 4px);z-index:2;display:flex;flex-direction:column;",
    "max-height:180px;overflow-y:auto;padding:4px;background:var(--paper);border:1px solid var(--ink-10);border-radius:8px;",
    "box-shadow:0 8px 18px var(--ink-12);transform-origin:50% 100%;animation:menuIn var(--enter) var(--arrive)}",
    "@keyframes menuIn{from{opacity:0;transform:translateY(6px) scale(.96)}to{opacity:1;transform:none}}",
    ".custom-option{border:0;border-radius:8px;padding:7px 8px;background:transparent;color:var(--ink);text-align:left;font:500 14px/1.2 inherit;cursor:pointer}",
    ".custom-option:hover{background:var(--ink-6)}",
    // A row that is already chosen says so with the same mark the open control
    // wears, so hover and chosen are never one colour.
    ".custom-option[aria-pressed=true]{background:var(--accent-soft);box-shadow:inset 0 0 0 1px var(--rose)}",
    ".size-control .custom-select{width:26px;flex:none}",
    ".size-control .custom-select-trigger{border:0;padding:0;background:transparent;display:grid;place-items:center;width:100%;height:26px}",
    // Upward, like every other list in the dock: the size button sits 24px above
    // the bottom of the viewport, so a list below it lands off the screen.
    ".size-control .custom-select-menu{bottom:calc(100% + 4px);top:auto;width:64px}",
    // The weight field is the size control in the dock, at the width of a field:
    // the number and a bare chevron in one chip, so the list is not a second box
    // standing beside the value.
    ".pop .weight-control{width:auto;gap:2px}",
    ".pop .weight-control .custom-select{width:26px;flex:none;min-width:0}",
    ".pop .weight-control .custom-select-trigger{border:0;padding:0;background:transparent;display:grid;place-items:center;width:100%;height:26px;color:var(--muted)}",
    ".pop .weight-control .custom-select-trigger:hover{color:var(--ink)}",
    // The arrow of a list that has a value field beside it. The arrow alone
    // says "there is a list here"; the value is the field's, and is not said
    // twice. Sized where it stands, and it borrows the colour of its row.
    ".custom-select-trigger.chevron>svg{width:14px;height:14px;display:block;color:inherit}",
    // A list off a bare arrow is as wide as its own words, and grows towards
    // the middle of the panel rather than past its edge.
    ".pop .weight-control .custom-select-menu{left:auto;right:0;bottom:calc(100% + 6px);width:max-content;min-width:140px}",
    // The picker is HeroUI's in build and behaviour — the field with the dot,
    // the hue rail, the value field — and every control on it is still drawn
    // rather than borrowed from the browser, because a native range cannot
    // carry a 20px track with a capped end. What it is not is HeroUI's in
    // colour: its white surface, its greys and its blue ring are a second
    // design system, and this one's palette is closed. The layer and the paper
    // are .pop's, so only the padding and the scroll are the picker's own.
    ".pop.color{padding:8px 8px 12px;",
    // A short viewport still reaches the value field: the panel scrolls, as
    // HeroUI's own popover does, rather than growing off the top of the screen.
    "max-height:calc(100vh - 96px);overflow-y:auto;overscroll-behavior:contain}",
    // The Controlled picker asks the popover for a tighter gap than the default,
    // and the width is the picker's own: the panel takes the room it needs and
    // the surface around it follows, wherever the picker stands.
    ".color-panel{display:flex;flex-direction:column;gap:8px;width:176px}",
    // The keyboard ring: 2px of paper, then the cobalt that carries every
    // interaction highlight in the ramp. Drawn on the control the pointer uses,
    // never on the hidden input.
    // The field: saturation across, brightness up, the hue underneath both. Its
    // layers are set from the colour on show; the dot wears the colour itself.
    ".field{position:relative;width:100%;aspect-ratio:1/1;border-radius:16px;cursor:crosshair;touch-action:none;",
    "box-shadow:inset 0 0 0 1px var(--ink-10)}",
    ".field[data-focus-visible=true]{box-shadow:inset 0 0 0 1px var(--ink-10);outline:2px solid var(--accent);outline-offset:2px}",
    ".field-thumb{position:absolute;width:16px;height:16px;border:3px solid var(--paper);border-radius:16px;transform:translate(-50%,-50%);",
    "box-shadow:0 0 0 1px var(--ink-10),inset 0 0 0 1px var(--ink-10);pointer-events:none;will-change:width,height;",
    "transition:width var(--slide) var(--standard),height var(--slide) var(--standard)}",
    ".field[data-dragging=true] .field-thumb{width:20px;height:20px}",
    // The sliders: one 20px track, a 10px cap at each end that carries the
    // colour the track stops short of, and a 16px dot with the same white ring.
    ".pick-row{display:flex;align-items:center;gap:8px;padding:0 4px}",
    ".slider{position:relative;width:100%;touch-action:none}",
    ".pick-row .slider{flex:1}",
    ".track{position:relative;height:20px;margin:0 10px;",
    "background:linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00);",
    "box-shadow:inset 0 1px 0 var(--ink-10),inset 0 -1px 0 var(--ink-10)}",
    ".track:before,.track:after{content:\"\";position:absolute;top:0;height:100%;width:10px}",
    // The caps carry the colours the track stops short of. On the hue slider that
    // is red at both ends — the hue it shows is fully saturated by definition —
    // and the alpha slider sets its own two: clear, and the colour itself.
    ".track:before{left:-10px;border-start-start-radius:16px;border-end-start-radius:16px;",
    "box-shadow:inset 1px 0 0 var(--ink-10),inset 0 1px 0 var(--ink-10),inset 0 -1px 0 var(--ink-10);",
    // The checkerboard is the ramp too: paper, then ink alpha. A grey pair here
    // was the one place a colour came from outside the five values.
    "background:linear-gradient(var(--track-start,#f00)),repeating-conic-gradient(var(--paper) 0% 25%,var(--ink-8) 0% 50%) 50%/16px 16px}",
    ".track:after{right:-10px;border-start-end-radius:16px;border-end-end-radius:16px;",
    "box-shadow:inset -1px 0 0 var(--ink-10),inset 0 1px 0 var(--ink-10),inset 0 -1px 0 var(--ink-10);",
    "background-color:var(--track-end,#f00)}",
    ".track-thumb{position:absolute;top:50%;z-index:1;width:16px;height:16px;border:3px solid var(--paper);border-radius:16px;transform:translate(-50%,-50%);",
    "pointer-events:none;box-shadow:0 1px 1px var(--ink-8),0 6px 12px var(--ink-12)}",
    ".slider[data-focus-visible=true] .track-thumb{outline:2px solid var(--accent);outline-offset:2px}",
    // The real input behind each drawn control: out of sight, out of the
    // pointer's way, and still the thing Tab lands on.
    "input.knob[type=range]{position:absolute;inset:0;width:100%;height:100%;margin:0;background:transparent;opacity:.0001;pointer-events:none}",
    // The button that opens the browser's own picker: one 32px circle, filled
    // with ink alpha because it stands on paper and the ramp has no grey to
    // fill it with.
    ".icon-button{display:inline-flex;width:32px;height:32px;flex:none;align-items:center;justify-content:center;border:0;",
    "border-radius:50%;padding:0;background:var(--ink-6);color:var(--ink);cursor:pointer}",
    ".icon-button:hover{background:var(--ink-10)}",
    ".icon-button>svg{width:16px;height:16px;display:block}",
    // The button's own input, held off-screen: the UA rule for a colour input
    // is a 44px well, and this one is never meant to be seen at all.
    "input.colour-picker[type=color]{position:absolute;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;border:0;padding:0}",
    // The value, in the field a form would use: the colour as a swatch, and the
    // words beside it.
    // The colour's field is the chip every other value wears: the swatch where a
    // glyph stands, the hex after it, and the transparency where a unit would be.
    // It spans the picker, and the picker is its width.
    ".value-field{width:100%}",
    ".value-field .chip{width:16px;height:16px;flex:none;border-radius:8px;box-shadow:inset 0 0 0 1px var(--ink-10)}",
    ".value-field input[type=text]{flex:1;min-width:7ch;height:100%;border:0;padding:0 4px;background:transparent;color:var(--ink);",
    "font-size:14px;font-weight:500;outline:none}",
    // The transparency, as the number it is: one line with the value, the way a
    // form wears a unit. The spinners are off so a three-character field holds
    // the number and the sign, and the arrow keys still step it.
    ".value-field .alpha{display:flex;align-items:center;flex:none;color:var(--muted);font-size:14px;font-weight:500}",
    ".value-field .alpha input[type=number]{width:3ch;height:100%;border:0;padding:0;background:transparent;color:inherit;",
    "font-size:14px;font-weight:500;font-variant-numeric:tabular-nums;text-align:right;outline:none;-webkit-appearance:none;appearance:none}",
    // Only the icon a control holds, never the box a glyph is drawn in: a Lucide
    // glyph is its own svg inside this one, and sizing that too would draw it 18
    // units wide in a 256 box. The `>` is what keeps this from reaching it.
    ".ic>svg{width:16px;height:16px;display:block;color:inherit}",
    // The text colour is the colour alone: a chip painted in the element own
    // colour. The chip is a real element so it takes focus and shows focus: a
    // background on the button could not be read out by anything, and an empty
    // chip is honest about knowing nothing, where one painted in our ink would
    // claim the site is that colour.
    ".sw{display:block;width:18px;height:18px;border-radius:6px;background:transparent;box-shadow:inset 0 0 0 1px var(--ink-20)}",
    // No min-width: each control is exactly as wide as its own content. A floor
    // here is what makes a row of four icons as wide as a list of face names,
    // with dead paper either side of the icons. The pop is out of the flow, so
    // an open control comes out over the dock.
    //
    // A floating layer, so: the same fill as its selected control, the diffuse
    // ink shadow that makes it float above the layer below, and the 16px layer
    // radius. Depth comes from those, never from an edge — without them the panel
    // read flatter than the dock under it.
    ".pop{position:absolute;bottom:calc(100% + 8px);left:0;max-inline-size:min(420px,calc(100vw - 24px));padding:8px;background:var(--paper);border:1px solid var(--ink-10);border-radius:12px;",
    // It grows out of the control that opened it: placePop() puts the
    // transform-origin on that control's centre, at the panel's bottom edge.
    "box-shadow:0 1px 1px var(--ink-8),0 10px 24px var(--ink-12);transform-origin:50% 100%;animation:popIn var(--enter) var(--arrive)}",
    "@keyframes popIn{from{opacity:0;transform:translateY(6px) scale(.95)}to{opacity:1;transform:none}}",
    // Two things in one panel stand a gap apart. A chip draws its own hairline,
    // so chips that touch read as one badly drawn box; the room between them is
    // the panel's, and it comes from the stack rather than from every control.
    ".pop>*+*{margin-top:8px}",
    ".list{display:flex;flex-direction:column;gap:1px;max-height:216px;overflow-y:auto;",
    // The host page scrollbar is the page scrollbar: without this the list shows
    // whatever the site styles its scrollbars with, or a chunky default. A hairline
    // in the ramp, inset so it never sits on the text, and no buttons.
    "scrollbar-width:thin;scrollbar-color:var(--ink-25) transparent;padding-right:4px}",
    ".list::-webkit-scrollbar{width:6px}",
    ".list::-webkit-scrollbar-track{background:transparent}",
    ".list::-webkit-scrollbar-thumb{background:var(--ink-25);border-radius:6px}",
    ".list::-webkit-scrollbar-thumb:hover{background:var(--ink-40)}",
    // One row per option: a face shows itself, an alignment shows its own lines.
    // width:max-content, not 100%: a row is as wide as its own label, so a short
    // name does not stretch the list and a long one is not clipped.
    ".opt{display:block;width:max-content;max-width:100%;text-align:left;border:0;",
    "border-radius:8px;padding:7px 10px;",
    "background:transparent;color:var(--ink);font:500 14px/1.2 inherit;cursor:pointer}",
    ".opt:hover{background:var(--ink-6)}",
    ".opt[aria-pressed=true]{background:var(--accent-soft);box-shadow:inset 0 0 0 1px var(--rose)}",
    ".opts{display:flex;gap:2px;padding:2px}",
    // The alignment control lays its row out as a real 3x3 grid instead. A cell
    // is the control: empty until it is picked, and filled once it is, so the
    // panel shows where the children go without a mark in every cell.
    ".opts.grid3{display:grid;grid-template-columns:repeat(3,34px);gap:2px;padding:2px}",
    ".grid3>.ic{background:var(--ink-4)}",
    ".grid3>.ic:hover{background:var(--ink-10)}",
    ".grid3>.ic[aria-pressed=true]{background:var(--ink)}",
    // One field to a line. A row that holds a value wears `fld` too: the chip
    // sets its own height and padding, and this rule only the flow around it.
    ".bar2{display:flex;align-items:center;gap:10px;padding:4px}",
    // Two fields to a line, so a shadow is read as a pair of pairs rather than
    // four rows: the offsets, then the two lengths of the edge. Each chip is as
    // wide as its own digits, so the columns are as wide as the chips.
    ".shadow-grid{display:grid;grid-template-columns:repeat(2,max-content);gap:6px;padding:2px 0}",
    ".pair{display:flex;flex-direction:column;gap:6px;padding:2px 0}",
    // A value and the list that decides where it goes, on one line: the chip is as
    // wide as its digits, and the list takes the room that is left.
    ".field-line{display:flex;align-items:center;gap:6px;padding:2px 0}",

    ".field-label{white-space:nowrap}",
    // A glyph may stand where a word would: a shadow's blur and spread are
    // marked, not named, so the four fields fit two lines, and so are the two
    // typography spacings.
    ".field-label>svg{width:14px;height:14px;display:block}",
    // One chip holds one value: the glyph that names it and the field on one
    // line, as the size and count chips in the dock hold theirs. Every chip
    // answers the pointer in the same three steps, in the dock's own times: ink
    // under the pointer, the open fill and a darker hairline while it holds the
    // caret, and a press that goes down fast and comes back slower. The value is
    // as wide as its digits and the room to type one more, so no field is wider
    // than what it holds.
    ".fld,.sides-pair>label,.value-field,.pop .weight-control{display:flex;align-items:center;gap:6px;height:30px;padding:0 6px;",
    "border:1px solid var(--ink-15);border-radius:8px;background:var(--paper);color:var(--muted);cursor:text}",
    ".fld:hover,.sides-pair>label:hover,.value-field:hover,.pop .weight-control:hover{background:var(--fill-hover)}",
    ".fld:focus-within,.sides-pair>label:focus-within,.value-field:focus-within,.pop .weight-control:focus-within{background:var(--fill-open)}",
    // A number is a value to turn, not only to type, so the pointer says so: the
    // two arrows over the digits, and the sideways arrows once a drag starts. A
    // focused field takes the text caret back, because typing is the way in.
    ".fld input[type=number],.sides-pair input[type=number],.value-field input[type=number],.pop .weight-control>input{cursor:ns-resize}",
    ".fld input[type=number]:focus,.sides-pair input[type=number]:focus,.value-field input[type=number]:focus,.pop .weight-control>input:focus{cursor:text}",
    "[data-scrub]{cursor:ew-resize}",
    ".fld:hover,.sides-pair>label:hover{border-color:var(--ink-25)}",
    ".fld input[type=number],.sides-pair input[type=number],.value-field input[type=number],.pop .weight-control>input{width:5ch;min-width:0;height:100%;border:0;border-radius:0;padding:0;background:transparent;color:var(--ink);",
    "font:500 14px/1 inherit;outline:none;font-variant-numeric:tabular-nums;box-shadow:none}",
    // The chip is the thing that answers, so the field inside it never lights, and
    // never wears a ring of its own.
    ".fld input[type=number]:hover,.fld input[type=number]:focus,.fld input[type=number]:focus-visible,",
    ".sides-pair input[type=number]:hover,.sides-pair input[type=number]:focus,.sides-pair input[type=number]:focus-visible,",
    ".value-field input[type=number]:hover,.value-field input[type=number]:focus,.value-field input[type=number]:focus-visible",
    "{background:transparent;border-color:transparent;box-shadow:none}",

    // The base every field stands on: the digits, the paint, and no spinner. No
    // rule here draws a box: the chip is the box. A dock chip that took a border
    // and 9px of padding from this rule was never the width it said it was.
    "input[type=number],input[type=search]{-webkit-text-fill-color:var(--ink);color:var(--ink);",
    "font:500 14px/1 inherit;outline:none;font-variant-numeric:tabular-nums;border:0;padding:0;background:transparent}",
    // A field that holds words cannot be as wide as its value, so the search keeps
    // the panel's width. It takes the same hover and the same focus as a chip.
    "input[type=search]{width:100%;margin-bottom:6px;border:1px solid var(--ink-15);border-radius:8px;padding:8px 10px;",
    "background:var(--paper);font-variant-numeric:normal}",
    "input[type=search]:hover{background:var(--fill-hover)}",
    "input[type=search]:focus{background:var(--fill-open)}",
    // A text field does not wear the ring: it answers :focus-visible to a pointer
    // too, so a click would draw a ring that says nothing happened. The fields
    // that hold a value put the ring on the chip around them instead.
    "input[type=search]::placeholder{-webkit-text-fill-color:var(--muted);color:var(--muted)}",
    "input[type=number]::-webkit-outer-spin-button,input[type=number]::-webkit-inner-spin-button",
    "{-webkit-appearance:none;margin:0}",
    // The brand pill: bottom-right while the mode is off, hidden while it is
    // on. Same surface and radius as a row.
    "#launch{position:fixed;right:24px;bottom:24px;height:38px;min-width:38px;touch-action:none;",
    "border-radius:10px;border:1px solid transparent;margin:0;padding:0 8px;cursor:pointer;pointer-events:auto;z-index:4;",
    "display:flex;align-items:center;justify-content:center;background:var(--surface);",
    "box-shadow:0 0 0 1px var(--ink-10),0 1px 2px var(--ink-6),0 6px 16px var(--ink-8);}",
    "#launch:hover{background:var(--fill-hover)}",
    "#launch img{width:18px;height:18px;display:block;border-radius:5px;pointer-events:none;-webkit-user-drag:none;user-select:none}",

    // The bounding box: a 1.5px line, drawn outside the element (the inset keeps
    // it off the content, as an outside stroke does), with no radius. The frame
    // is the positioning parent for the handles, and one colour dresses the
    // whole box: the ramp value that opposes what it lies on, so the line and
    // the handles always stand off the page they cross.
    ".frame{position:fixed;pointer-events:none;z-index:1;box-sizing:border-box;",
    // The colour of a frame is the palette's own, so it reads as one of the
    // chrome's five values: --ink until place() sets the contrast colour.
    "border:1.5px solid var(--frame,var(--ink));border-radius:0;background:transparent}",
    // The handles are that line in multiples: a corner disc 5 lines across
    // (7.5px) and an edge bar 3 lines thick (4.5px) and at most 16 lines long
    // (24px), with round ends because the radius is half the bar. They are
    // drawn, not held: a handle that took the pointer would keep a click that
    // belongs to the page under it, since the chrome's own clicks are ignored.
    ".frame-marker{position:absolute;background:var(--frame,var(--ink));pointer-events:none}",
    ".frame-marker.corner{width:7.5px;height:7.5px;border-radius:50%}",
    ".frame-marker.edge{width:4.5px;height:min(24px,40%);border-radius:2.25px}",
    ".frame-marker.edge.horizontal{width:min(24px,40%);height:4.5px}",
    ".frame-marker.edge.horizontal{left:50%;transform:translateX(-50%)}",
    ".frame-marker.edge:not(.horizontal){top:50%;transform:translateY(-50%)}",
    ".frame.short [data-edge=left],.frame.short [data-edge=right],",
    ".frame.narrow [data-edge=top],.frame.narrow [data-edge=bottom]{display:none}",
    // The offsets are half the shape they centre: the disc on the corner, and the
    // bar on the middle of the stroke, which is one line inside the frame.
    "[data-corner=\"top left\"]{left:-3.75px;top:-3.75px}[data-corner=\"top right\"]{right:-3.75px;top:-3.75px}",
    "[data-corner=\"bottom left\"]{left:-3.75px;bottom:-3.75px}[data-corner=\"bottom right\"]{right:-3.75px;bottom:-3.75px}",
    "[data-edge=left]{left:-3px}[data-edge=right]{right:-3px}",
    "[data-edge=top]{top:-3px}[data-edge=bottom]{bottom:-3px}",
    // A card of its own at the element, not a row of the dock: fixed, so it can
    // stand at the element while the dock stays at the bottom of the page.
    ".element-menu{position:fixed;z-index:5;width:max-content;max-width:min(420px,calc(100vw - 24px - env(safe-area-inset-left) - env(safe-area-inset-right)));padding:8px;background:var(--paper);border:1px solid var(--ink-10);border-radius:12px;box-shadow:0 1px 2px var(--ink-6),0 6px 16px var(--ink-8);pointer-events:auto}",
    // A pronounced container: thin low-contrast border, softer corner and a
    // diffused shadow so it stands apart without floating high.
    ".element-menu:has(.element-comment){z-index:7;border-radius:22px;padding:13px;background:var(--surface);border-color:var(--ink-10);box-shadow:0 2px 6px var(--ink-6),0 16px 40px var(--ink-8);transform:scale(.9);transform-origin:0 0}",
    ".element-menu-actions{display:flex;flex-wrap:wrap;gap:2px}",
    // An action wears what a control in the dock wears: the same 34px square, the
    // same 8px radius, the same hover fill and the same press. The row's fill
    // travels under the pointer, which one square cannot do, so the fill is the
    // one it lands in.
    ".element-action{display:grid;place-items:center;width:30px;height:30px;border:0;border-radius:7px;padding:0;",
    "background:transparent;color:var(--muted);font:500 13px/1 inherit;cursor:pointer}",
    "@media (hover:hover){.element-action:hover{background:var(--ink-6);color:var(--ink)}}",
    ".element-action:disabled{opacity:.42;cursor:default;pointer-events:none}",
    ".element-action.delete{color:var(--muted)}",
    // The one button of the done card wears its words, not a 34px square.
    ".element-action.done{width:auto;padding:0 12px}",
    ".element-action>svg{width:16px;height:16px;display:block;flex:none;color:inherit}",
    ".element-comment{display:flex;flex-direction:column;gap:6px;width:245px;position:relative;transform-origin:50% 0;animation:cardIn var(--enter) var(--arrive)}",
    "@keyframes cardIn{from{opacity:0;transform:translateY(6px) scale(.98)}to{opacity:1;transform:none}}",
    // The waiting state of a variation request: what to type, and the X that puts
    // the box away. The words stay quiet, the two commands the user copies are
    // chips, and the connect hint is set off by a hairline.
    ".wait{display:flex;flex-direction:column;gap:10px;width:240px}",
    ".wait-head{display:flex;align-items:center;justify-content:space-between;gap:6px}",
    ".wait-title{display:flex;align-items:center;gap:8px;margin:0;font:500 13px/1.3 inherit;color:var(--ink)}",
    // The dot rests where the pulse rests, so a reader who has asked for less
    // motion sees the same dot, only still.
    ".wait-dot{width:8px;height:8px;flex:none;border-radius:50%;background:var(--accent);opacity:.3;transform:scale(.8);",
    "animation:waitPulse var(--pulse) var(--breathe) infinite}",
    "@keyframes waitPulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}",
    ".wait-line{margin:0;display:flex;flex-wrap:wrap;align-items:center;gap:6px;font:400 12px/1.3 inherit;color:var(--muted)}",
    ".wait-say{margin:0;font:400 12px/1.3 inherit;color:var(--muted)}",
    ".wait-hint{margin:0;padding-top:9px;border-top:1px solid var(--ink-8);display:flex;flex-wrap:wrap;align-items:center;gap:6px;font:400 11px/1.3 inherit;color:var(--muted)}",
    ".wait-chip{display:inline-flex;align-items:center;height:22px;padding:0 7px;border-radius:6px;background:var(--ink-6);color:var(--ink);font:500 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace}",
    ".wait-x{width:24px;height:24px;flex:none;display:grid;place-items:center;border:0;border-radius:6px;padding:0;background:transparent;color:var(--muted);cursor:pointer}",
    ".wait-x:hover{background:var(--ink-6);color:var(--ink)}",
    ".wait-x>svg{width:14px;height:14px;display:block}",
    // 1. Comment input: the primary field — roomier padding, larger type,
    // a soft radius and a brand-accent focus ring.
    ".element-comment-text{width:100%;min-height:58px;resize:vertical;padding:11px;border:1px solid var(--ink-20);border-radius:13px;background:var(--paper);color:var(--ink);font:400 12px/1.5 inherit;box-shadow:0 1px 2px var(--ink-6),inset 0 1px 2px var(--ink-6);transition:border-color var(--tint) var(--standard),box-shadow var(--tint) var(--standard)}",
    ".element-comment-text::placeholder{color:var(--muted);opacity:.7}",
    "@media (hover:hover){.element-comment-text:hover{border-color:var(--ink-25)}}",
    ".element-comment-text:focus{outline:none;border-color:var(--accent);background:var(--paper);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 18%,transparent)}",
    ".element-comment-text:focus-visible{outline:none;box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 18%,transparent)}",
    // 2. Temporary canvas: a full-width row with a visible hover fill and a
    // keyboard-visible tick.
    ".element-comment-row{position:relative;display:flex;align-items:center;justify-content:flex-start;text-align:left;gap:6px;width:100%;padding:5px 8px 5px 5px;border:0;border-radius:12px;background:transparent;font:400 8px/1.3 inherit;color:var(--muted);cursor:pointer;transition:background-color var(--tint) var(--standard)}",
    ".element-comment-row .tick{position:absolute;opacity:0;width:1px;height:1px;margin:0}",
    ".element-comment-row input:focus-visible+.element-comment-mark{outline:none;box-shadow:0 0 0 2px var(--paper),0 0 0 4px var(--accent)}",
    ".element-comment-row:focus-within{outline:none;box-shadow:none}",

    // The Save button carries words, so it takes the width it is given
    // rather than the square an action is.
    // The comment box. It wears the toolbar's scale: no wider than the
    // dock, no taller than its rows, so the comment never dwarfs what it
    // comments on. The typing field keeps one color here and everywhere;
    // only shape moves. Cancel and Save sit together at the right, Save
    // gold — brand fill, ink on it, the dock's own.
    // 5. Footer: taller buttons, Save dominant, Cancel ghost, both with
    // hover, press, disabled and focus states.
    ".element-menu .element-comment .element-menu-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:0}",
    ".element-menu .element-comment .element-comment-action{flex:none;width:auto;height:31px;padding:0 15px;border-radius:9px;white-space:nowrap;font:500 10px/1 inherit;transition:background-color var(--tint) var(--standard),filter var(--tint) var(--standard),opacity var(--tint) var(--standard)}",
    ".element-menu .element-comment [data-key=comment-save]{min-width:80px;background:var(--brand);color:var(--on-brand);font-weight:600;box-shadow:0 1px 4px var(--ink-8)}",
    "@media (hover:hover){.element-menu .element-comment [data-key=comment-save]:hover:not(:disabled){filter:brightness(1.06)}}",
    ".element-menu .element-comment [data-key=comment-save]:active:not(:disabled){filter:brightness(.96)}",
    ".element-menu .element-comment [data-key=comment-save]:disabled{opacity:.45;cursor:default;box-shadow:none}",
    ".element-menu .element-comment [data-key=comment-save]:focus-visible{outline:2px solid var(--accent);outline-offset:2px}",
    "@media (hover:hover){.element-menu .element-comment [data-key=comment-cancel]:hover:not(:disabled){background:var(--ink-6);color:var(--ink)}}",
    ".element-menu .element-comment [data-key=comment-cancel]:active:not(:disabled){background:var(--ink-8)}",
    ".element-menu .element-comment [data-key=comment-cancel]:focus-visible{outline:2px solid var(--accent);outline-offset:2px}",
    ".element-menu .element-comment [data-key=comment-cancel]{background:transparent;border:0;color:var(--muted)}",
    // 3. The count: evenly sized pill chips, a press and a focus ring, and
    // words that say what Save does.
    ".element-comment-modes{display:flex;flex-direction:column;align-items:flex-start;gap:6px;width:100%}",
    ".element-comment-chips{display:flex;width:100%;gap:6px}",
    ".element-comment-chip{display:grid;place-items:center;flex:1;height:29px;padding:0 7px;border:1px solid var(--ink-20);border-radius:999px;background:var(--paper);color:var(--muted);font:500 10px/1 inherit;font-variant-numeric:tabular-nums;cursor:pointer;transition:background-color var(--tint) var(--standard),color var(--tint) var(--standard),border-color var(--tint) var(--standard),box-shadow var(--tint) var(--standard),transform var(--tint) var(--standard)}",
    "@media (hover:hover){.element-comment-chip:hover{background:var(--ink-6);color:var(--ink);border-color:var(--ink-25)}}",
    ".element-comment-chip:active{transform:scale(.97)}",
    ".element-comment-chip:focus-visible{outline:2px solid var(--accent);outline-offset:2px}",
    ".element-comment-chip[aria-checked=true]{background:var(--ink-15);border-color:var(--ink-35);color:var(--ink);box-shadow:0 1px 3px var(--ink-15)}",
    // The tick: a square and a clear check, with its label beside it.
    ".element-comment-mark{display:grid;place-items:center;width:14px;height:14px;flex:none;border:1.5px solid var(--ink-20);border-radius:5px;background:var(--paper);color:transparent;transition:background-color var(--tint) var(--standard),color var(--tint) var(--standard),border-color var(--tint) var(--standard),box-shadow var(--tint) var(--standard)}",
    ".element-comment-row input:checked+.element-comment-mark{background:var(--accent);border-color:var(--accent);color:var(--paper)}",
    ".element-comment-mark>svg{width:9px;height:9px;display:block}",
    ".element-comment-switch-words{display:flex;align-items:center;gap:5px;flex:none;min-width:0}",
    ".element-comment-switch-words span{font:500 8px/1.3 inherit;color:var(--ink);white-space:nowrap}",
    // The variation strip: fixed to the bottom right, out of the dock's way, so
    // the element stays in sight while its variations are compared. It wears the
    // element card's paper, and one row per variation carries its key and label.
    ".variants{position:fixed;right:24px;bottom:24px;z-index:6;display:flex;flex-direction:column;width:max-content;max-width:min(280px,calc(100vw - 24px));background:var(--paper);border:1px solid var(--ink-10);border-radius:12px;",
    "box-shadow:0 1px 2px var(--ink-6),0 6px 16px var(--ink-8);pointer-events:auto;transform-origin:100% 100%;animation:stripIn var(--enter) var(--arrive)}",
    "@keyframes stripIn{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:none}}",
    // The head names the strip and the element it varies, and holds the one
    // action that ends it. It is a row, not a title: the tag sits in the same
    // line, in the muted tone of a caption.
    ".variants-head{display:flex;align-items:center;gap:8px;padding:10px 10px 10px 14px}",
    ".variants-title{margin:0;font:500 13px/1.2 inherit;color:var(--ink)}",
    ".variants-of{font:400 12px/1.2 inherit;color:var(--muted)}",
    // Keep is small and quiet: it is the last step, and it is worth nothing
    // until a variation is on the element.
    ".variants-keep{margin-left:auto;height:28px;padding:0 10px;border:0;border-radius:8px;background:transparent;box-shadow:inset 0 0 0 1px var(--ink-20);",
    "color:var(--ink);font:500 13px/1 inherit;cursor:pointer}",
    ".variants-keep:hover:not(:disabled){background:var(--ink-6)}",
    ".variants-keep:disabled{opacity:.4;cursor:default}",
    // Ten rows are more than a short window holds, so the list scrolls and the
    // head stays put. A hairline under the head sets the list apart.
    ".variants-list{display:flex;flex-direction:column;gap:2px;max-height:min(46vh,376px);overflow-y:auto;overscroll-behavior:contain;padding:8px 6px;border-top:1px solid var(--ink-10)}",
    ".variant{display:flex;align-items:center;gap:8px;height:34px;padding:0 10px 0 6px;border:0;border-radius:8px;background:transparent;",
    "color:var(--ink);font:500 14px/1 inherit;text-align:left;cursor:pointer}",
    ".variant:hover{background:var(--ink-4)}",
    ".variant[aria-pressed=true]{background:var(--accent-soft);box-shadow:inset 0 0 0 1px var(--rose)}",
    ".variant .key{display:grid;place-items:center;width:22px;height:22px;flex:none;border-radius:6px;background:var(--ink-6);",
    "color:var(--muted);font:500 12px/1 inherit;transition:background-color var(--tint) var(--standard),color var(--tint) var(--standard)}",
    // The one on the element wears gold, the way the open control in the dock
    // does, and keeps ink on it: gold under paper words is 2.1:1.
    ".variant[aria-pressed=true] .key{background:var(--brand);color:var(--on-brand)}",
    ".variant .words{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    // The agent-placed preview: the same card as the variant strip, with the
    // instruction on top and Keep and Discard at its foot.
    ".preview-id{margin:0;font:400 11px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted)}",
    ".preview-say{margin:8px 14px 0;font:400 12px/1.4 inherit;color:var(--ink)}",
    ".preview-foot{display:flex;gap:6px;padding:10px 10px 10px 14px;border-top:1px solid var(--ink-10)}",
    ".preview-foot .variants-keep{margin-left:0}",
    // More than one preview at once: a row per instruction, a tick each, and one
    // batch button that keeps the ticked ones or, with none ticked, takes back
    // the whole lot. The tick is drawn in a span, not on the input itself, because
    // a replaced element wears no pseudo-element.
    ".preview-row{position:relative;display:flex;align-items:center;gap:8px;height:34px;padding:0 10px 0 6px;border-radius:8px;font:500 13px/1 inherit;color:var(--ink);text-align:left;cursor:pointer}",
    ".preview-row:hover{background:var(--ink-4)}",
    ".preview-row:focus-within{outline:none;box-shadow:0 0 0 2px var(--paper),0 0 0 4px var(--accent)}",
    ".preview-row .tick{position:absolute;opacity:0;width:1px;height:1px;margin:0}",
    ".preview-row .mark{display:grid;place-items:center;width:16px;height:16px;flex:none;border:1px solid var(--ink-20);border-radius:5px;background:var(--paper);color:transparent;transition:background-color var(--tint) var(--standard),color var(--tint) var(--standard),border-color var(--tint) var(--standard)}",
    ".preview-row input:checked+.mark{background:var(--accent);border-color:var(--accent);color:var(--paper)}",
    ".preview-row .mark>svg{width:10px;height:10px}",
    ".preview-row .words{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    // The chevron folds the row's place down into a line, so the reader knows
    // where the change lands before deciding on it.
    ".preview-row .more{display:grid;place-items:center;width:24px;height:24px;flex:none;margin-right:-4px;border:0;border-radius:6px;background:transparent;color:var(--muted);cursor:pointer}",
    ".preview-row .more:hover{background:var(--ink-6);color:var(--ink)}",
    ".preview-row .more:focus-visible{outline:none;box-shadow:0 0 0 2px var(--paper),0 0 0 4px var(--accent)}",
    ".preview-row .more>svg{width:12px;height:12px;transform:rotate(90deg);transition:transform var(--tint) var(--standard)}",
    ".preview-row[data-open] .more>svg{transform:rotate(180deg)}",
    ".preview-item{display:flex;flex-direction:column}",
    ".preview-detail{margin:0;padding:2px 34px 6px 30px;font:400 11px/1.5 inherit;color:var(--muted)}",
    // The placement cursor. It fades in where it stands rather than appearing,
    // because it is a target the pointer is about to aim at.
    ".insert{position:fixed;z-index:2;height:2px;background:var(--muted);pointer-events:none;opacity:0;",
    "transition:opacity var(--fade) var(--standard)}",
    ".insert[data-on]{opacity:1}",
    ".insert>svg{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);",
    "width:22px;height:22px;padding:2px;border:2px solid var(--paper);border-radius:50%;background:var(--muted);",
    "color:var(--paper);box-shadow:0 0 0 1px var(--muted)}",
    // The reduced-motion policy, in one rule: every duration collapses, every
    // animation runs once and stops, every delay goes. The same rule, in the
    // same words, is in src/motion.css for the site.
    "@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:1ms!important;animation-iteration-count:1!important;transition-duration:1ms!important;transition-delay:0ms!important}}",
    // Two pairs of sides, each pair with the link that ties it. A box is even
    // both ways far more often than not, so a tied pair is ONE field: top follows
    // the same value as bottom, and left the same as right.
    ".sides{display:flex;flex-direction:column;gap:6px;padding:0 6px 6px}",
    ".sides-pair{display:grid;grid-template-columns:76px 76px 34px;gap:6px;align-items:center}",
    // The one field of a tied pair takes the room of the two it stands for.
    ".sides-pair>label.wide{grid-column:1/3}",
    ".sides-pair label>svg{width:14px;height:14px;flex:none;display:block}",
    // A field that is put away is not drawn at all, and is not a grid cell either.
    ".sides [hidden]{display:none}",
    ".sides .side-link{width:34px;height:30px;border-radius:8px;background:transparent;color:var(--muted)}",
    ".sides .side-link:hover{background:var(--ink-6)}",
    ".sides .side-link[aria-pressed=true]{background:var(--accent-soft);box-shadow:inset 0 0 0 1px var(--rose);color:var(--ink)}",
    // The bar holds the row under the open control.
    ".bar{position:relative;display:flex;align-items:center;gap:0;width:max-content;max-width:100%;padding-left:0;background:var(--surface);border-radius:10px;box-shadow:0 1px 2px var(--ink-6),0 4px 16px var(--ink-8),0 8px 32px var(--ink-6);",
    "transition:padding-left var(--slide) var(--arrive)}",
    // The bar gives the grip its room only while it is hovered, or while the
    // grip itself is keyboard-focused. A clicked tool keeps :focus-within
    // and would pin the bar wide after the mouse has gone; :focus-visible
    // on the grip does not, and the mouse still gets its widening on hover.
    "#dock:hover .bar,#dock:has(.grip:focus-visible) .bar{padding-left:24px}",
    // A dragged dock stands from its left edge, so its widening would run
    // right, under the tools. While it is placed it gives back on its left
    // exactly what the bar takes, in the same beat, and the tools stand still.
    "#dock[data-placed]{transition:margin-left var(--slide) var(--arrive)}",
    "#dock[data-placed]:hover,#dock[data-placed]:has(.grip:focus-visible){margin-left:-24px}",
    // Every button carries its label for the keyboard; the row reads as icons,
    // so the text stays hidden and the drawn tooltip does the talking.
    ".lbl{display:none}",
    // The one mark of a control that is open, declared after every control it can
    // land on: the warm fill, a hairline in the ramp and the ink. A control that
    // opens says so the same way, whether it is the row's or the colour button.
    ".ic[aria-expanded=true]{background:var(--accent-soft);border-color:var(--rose);color:var(--ink)}",
    // The tooltip of a control, in the dock and in the element card alike:
    // a callout — elevated graphite, ink words, a hairline border and a small arrow
    // pointing at the control. Drawn here because the browser own title is
    // slow and cannot wear the ramp. It stays smaller than the row itself,
    // so it reads as a label on the toolbar.
    ".tip{position:fixed;z-index:9;pointer-events:none;min-width:44px;padding:6px 10px;border-radius:8px;text-align:center;white-space:nowrap;",
    "background:color-mix(in srgb,var(--ink) 18%,var(--paper));color:var(--ink);border:1px solid var(--ink-25);font:500 11px/1.4 inherit;",
    "box-shadow:0 4px 10px var(--ink-8),0 18px 44px var(--ink-15);transform-origin:50% 100%}",
    // The arrow: a diamond straddling the border, pointing at the control.
    // Above the control it points down; below, it points up.
    ".tip::after{content:\"\";position:absolute;left:50%;width:8px;height:8px;background:color-mix(in srgb,var(--ink) 18%,var(--paper));",,
    "border-right:1px solid var(--ink-25);border-bottom:1px solid var(--ink-25)}",
    ".tip[data-side=top]::after{bottom:-1px;transform:translate(-50%,50%) rotate(45deg)}",
    ".tip[data-side=bottom]::after{top:-1px;transform:translate(-50%,-50%) rotate(-135deg)}",
    ".tip>span{display:block}",
    // A tip over the comment card wears the card's size: 90% of every part.
    ".tip[data-size=small]{min-width:40px;padding:5.4px 9px;border-radius:7px;font:500 9.9px/1.4 inherit;box-shadow:0 3.6px 9px var(--ink-8),0 16.2px 39.6px var(--ink-15)}",
    ".tip[data-size=small]::after{width:7px;height:7px}",
    ".count{position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 6px;",
    "border-radius:28px;background:var(--rose);color:var(--ink);font:500 14px/20px inherit;text-align:center}",
    // One edited element per line: its name selects it, the arrow reverts it.
    ".chg{display:flex;align-items:center;gap:2px}",
    ".chg .opt{flex:1}",
    ".chg .ic{width:30px;height:30px;flex:none}",
    ".note{margin:6px 10px;max-width:240px;font:400 11px/1.4 inherit;color:var(--muted)}",
    // A note in the element card sits in its own gap, not on a margin of its own.
    ".element-comment .note{margin:0;font-size:10px}",
    ".cta{flex:1;border:0;border-radius:8px;padding:12px 16px;background:var(--ink);color:var(--paper);white-space:nowrap;",
    "font:500 14px/1 inherit;cursor:pointer;min-width:11rem;text-align:center}",
    ".cta:hover{background:var(--muted)}",
    // The words of a button that answers (Copied, Saved) change in place: the
    // old words leave, the new ones rise in, and the button does not move.
    // The button is as wide as its longest wording, so the words change inside
    // a box that stays where it was.
    ".say{display:inline-block}",
    ".cta:disabled{opacity:.4;cursor:default;background:var(--ink)}",
    ".cta.ghost{background:transparent;color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink-20)}",
    ".cta.ghost:hover{background:var(--ink-6)}",
    ".cta.ghost:disabled{background:transparent}",
    // The press and the tint, in one place. Every control that answers the
    // pointer gives the same answers: a colour that changes, a press that goes
    // down fast and comes back slow, and nothing else.
    //
    // The press is a duration the control sets for itself, and the press rule
    // swaps it. A transition reads its duration in the state it is in, so the
    // way down is quick and the way back is the release — with no list of
    // durations to keep in step with the list of properties.
    ".ic,.opt,.cta,.element-action,.variant,.icon-button,.fld,.sides-pair>label,.value-field,.pop .weight-control,",
    ".custom-select-trigger,.custom-option{",
    "--press-dur:var(--settle);",
    "transition:background-color var(--tint) var(--standard),border-color var(--tint) var(--standard),color var(--tint) var(--standard),box-shadow var(--tint) var(--standard),transform var(--press-dur) var(--arrive)}",
    // One press, for every control that answers the pointer: one amount and one
    // pair of times. A local :active is how the amounts drifted apart.
    ".ic:active,.opt:active,.cta:active:not(:disabled),.element-action:active,.variant:active,.icon-button:active,",
    ".fld:active,.sides-pair>label:active,.value-field:active,.pop .weight-control:active,",
    ".custom-select-trigger:active,.custom-option:active{--press-dur:var(--press);transform:scale(.96)}",
    // The keyboard ring, in one place too: a 2px line in the accent that reads on
    // paper. Every button in the chrome wears it, so nothing falls back to the
    // browser's own ring inside the shadow root.
    "button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}",
    // A control that only changes colour, and is never pressed.
    "input[type=search],.element-comment-text,.variants-keep{",
    "transition:background-color var(--tint) var(--standard),border-color var(--tint) var(--standard),color var(--tint) var(--standard),box-shadow var(--tint) var(--standard)}",
    "</style>",
    '<button type="button" id="launch" title="Edityy" aria-label="Open Edityy"><img id="label" alt="Edityy logo" draggable="false" src="' + LOGO + '"></button>',
    '<div class="frame" id="hover" hidden></div>',
    // The selection frame carries the four corner markers, so their
    // positions follow the frame wherever the element moves.
    '<div class="frame" id="sel" hidden>',
    '<i class="frame-marker corner" data-corner="top left"></i>',
    '<i class="frame-marker corner" data-corner="top right"></i>',
    '<i class="frame-marker corner" data-corner="bottom left"></i>',
    '<i class="frame-marker corner" data-corner="bottom right"></i>',
    '<i class="frame-marker edge" data-edge="left"></i>',
    '<i class="frame-marker edge" data-edge="right"></i>',
    '<i class="frame-marker edge horizontal" data-edge="top"></i>',
    '<i class="frame-marker edge horizontal" data-edge="bottom"></i></div>',
    '<div class="marks" id="marks" hidden></div>',
    '<div class="region" id="region" hidden></div>',
    '<div class="element-menu" id="element-menu" hidden role="toolbar" aria-label="Element actions"></div>',
    // The variations of one element, at the bottom right, and the keys that
    // switch between them.
    '<div class="variants" id="variants" hidden role="group" aria-label="Style variations"></div>',
    // The chat-initiated preview: one box per agent answer, with Keep and
    // Discard, and the same keys the variant strip answers to.
    '<div class="variants" id="preview" hidden role="group" aria-label="Canvas preview"></div>',
    '<div class="insert" id="insert" aria-hidden="true">',
    svg("plus"),
    "</div>",
    "<div id=\"dock\" hidden>",
    '<button type="button" class="dock-close" id="dock-close" aria-label="Close editing">' +
    svg("x") +
    "</button>",
    '<div class="pop" id="pop" hidden></div>',
    '<div class="bar" id="bar">',
    // The grip is the toolbar's handle: left of the row, its own pill, so it
    // reads as the way to move the bar and not a fourth tool. Six dots.
    '<button type="button" class="grip" id="grip" aria-label="Move toolbar">',
    '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">',
    '<circle cx="5.5" cy="3.5" r="1.5"/><circle cx="10.5" cy="3.5" r="1.5"/>',
    '<circle cx="5.5" cy="8" r="1.5"/><circle cx="10.5" cy="8" r="1.5"/>',
    '<circle cx="5.5" cy="12.5" r="1.5"/><circle cx="10.5" cy="12.5" r="1.5"/></svg></button>',
    '<div class="row" id="row" role="toolbar" aria-label="Edityy toolbar">',
    // The edits list is the row's last tool, dressed like the three before it:
    // the same icon, with the count badge on it while there are edits to list.
    '<button type="button" class="ic" id="review" data-key="edits" aria-label="Edits" aria-expanded="false">',
    svg("square-text"),
    '<span class="count" id="count" hidden></span></button></div>',
    "</div>",
    "</div>",
    "</div>",
    '<div class="tip" id="tip" role="tooltip" hidden></div>',
    // The line a number says once: the wheel turns it. It reuses the tip's face.
    '<div class="tip" id="hint" role="status" hidden></div>',
  ].join("");

  var $ = function (id) {
    return root.getElementById(id);
  };
  var launch = $("launch");
  var hoverBox = $("hover");
  var selBox = $("sel");
  var elementMenu = $("element-menu");
  var variantsBox = $("variants");
  var previewBox = $("preview");
  var insertLine = $("insert");
  var dock = $("dock");
  var row = $("row");
  var gripBtn = $("grip");
  var launchImg = $("label");
  // The row and the edits button it sits beside: one surface on the page.
  var barEl = $("bar");
  // True only while the open choreography below is running: it is what lets
  // the controls stagger in on entry, and nowhere else.
  var entering = false;
  var pop = $("pop");
  var review = $("review");
  var marksBox = $("marks");
  var regionBox = $("region");
  var tip = $("tip");
  var hint = $("hint");
  // The hint is a once-in-a-page offer: after it, the pointer says the same
  // thing, so the words would only repeat themselves.
  var hintDone = false;
  var hintTimer = 0;
  // How long the hint stays up before it goes. A time, not a motion: it says
  // how long the reader has to read it, not how long anything takes to move.
  var HINT_HOLD = 1000;
  // A status the reader did not ask for stays longer than the one that answers a
  // gesture: it says what happened to their edit, not what a control does.
  var REPLACED_HOLD = 2400;
  // The control that is open, "" for none.
  var openKey = "";
  // The panel's own fade, while it is on its way out.
  var popLeaving = null;
  // The dock's own fade, and the element card's.
  var dockLeaving = null;
  var menuLeaving = null;
  var countBadge = $("count");
  // The `+` sits at the end of the row and a revealed control goes in before it,
  // so adding one grows the row leftwards from the button that added it.

  // The font stacks a machine already has. No webfonts load with the editor: it
  // must not change what the page loads, only what it looks like. A Google font
  // is fetched only when the family control draws or picks it. The first entry
  // is the site's own face, taken from the app's own token wherever it sets one.
  var active = false;
  var selected = null;
  var selectedItems = [];
  var extraSelectionFrames = [];
  // The kind of the current selection: it decides which controls the dock starts
  // with, and root.selection() reports it.
  var selectedKind = null; // "text" | "container" | "media"
  // The element whose words are being typed into, if any. One at a time: a new
  // selection closes the last, or two elements would both take the caret.
  var editing = null;
  // One record per touched element:
  //   { el, props: {prop: inline value before}, set: {prop: was it set at all},
  //     was: {prop: computed value before}, text: words before | null,
  //     html: markup before | undefined, added: [keys] }
  var changes = [];
  // The next number a changed element takes. One per element, never reused.
  var markTop = 1;
  // Boxes the Add tool drew. Page distances, so a scroll does not move them.
  var regions = [];
  var drawing = null; // the box on the pointer now, or null
  var regionFor = null; // the drawn box whose comment box is open
  // A drag smaller than this is a click, not a box.
  var REGION_MIN = 8;
  var insertion = null;
  var pointerX = null;
  var pointerY = null;
  var moving = null;

  /* ------------------------------------------------------------ selection */

  /** Does this element hold text of its own, rather than only child elements? */
  function hasOwnText(el) {
    var nodes = el.childNodes;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].nodeType === 3 && nodes[i].nodeValue.trim()) return true;
    }
    return false;
  }

  /** Text we can rewrite as a single string: no child elements to destroy. */
  function isLeafText(el) {
    // children, not childNodes: an element child is in both, a text node only in
    // childNodes. A container is a container either way, so the one list that
    // holds every element is the one to read.
    return !el.children.length && hasOwnText(el);
  }

  /**
   * Elements Edit text opens on: any that hold words of their own.
   *
   * That includes an element whose words are split by child elements — a
   * paragraph around a link, a heading with an <em> in it. The words are typed
   * into where they stand, and exit puts the markup back as it was, so a child
   * element the browser drops while the caret is in the words comes back.
   */
  function canEditText(el) {
    return hasOwnText(el);
  }

  /**
 * What kind of thing is this element? Three buckets, nothing else.
 *
 * Decided before anything is selected, because the three need different handling
 * and guessing later is how a media element ends up with a text cursor in it.
 *
 *   media     — it *is* the media: img, svg, video, canvas, and the host it loads
 *   text      — it holds words of its own
 *   container — everything else, and it is the largest bucket on purpose
 *
 * The order is the whole rule, and it is deliberately short: media, then text,
 * then everything else falls into container. Naming the containers explicitly
 * would be a list that is wrong the moment the page uses a tag nobody thought of,
 * so nothing is named — a <div> holding no words is a container because there is
 * no text in it, not because div is on a list.
 *
 * A control with words in it — <button>Save</button>, <a>Read more</a> — is text,
 * because that is the copy the reader sees and the copy anyone means to change.
 * Its bare shell is a container. Both readings are defensible; this is the one
 * that keeps Save editable.
 */
  function kind(el) {
    if (!el) return null;
    var tag = el.tagName.toLowerCase();
    if (tag === "img" || tag === "svg" || tag === "video" || tag === "audio" || tag === "canvas" || tag === "picture") {
      return "media";
    }
    // <svg><text>Chart</text></svg>: the words are text, but they live inside a
    // drawing. Called text, because editing them is the useful thing to do and
    // the user can do it nowhere else.
    if (tag === "text") return "text";
    if (hasOwnText(el)) return "text";
    return "container";
  }

  /**
   * The element under the pointer, classified.
   *
   * Text wins the walk upward, because clicking words should select words. But a
   * media element wins over the text around it: clicking a picture must not land
   * on the caption beside it.
   */
  function pickAt(x, y) {
    var el = document.elementFromPoint(x, y);
    while (el && el.host === host) el = el.parentElement; // never select ourselves
    var fallback = el;
    while (el && el !== document.body && el !== document.documentElement) {
      var k = kind(el);
      // Media stops the walk outright: the nearest one is what was aimed at.
      if (k === "media") return { el: el, kind: k };
      if (k === "text") return { el: el, kind: k };
      el = el.parentElement;
    }
    return fallback && fallback !== document.body && fallback !== document.documentElement
      ? { el: fallback, kind: kind(fallback) }
      : null;
  }

  function textAt(x, y) {
    var hit = pickAt(x, y);
    return hit ? hit.el : null;
  }

  /**
   * A short, human way to name an element: "h1 “Edityy”". What the edits list
   * shows. Not called `label`: that id is the brand mark, further up.
   */
  function nameOf(el) {
    var snippet = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 28);
    return el.tagName.toLowerCase() + " " + (snippet ? "“" + snippet + "”" : "");
  }

  /* -------------------------------------------------------------- changes */

  // A state, a pseudo-element or a breakpoint cannot live in an element's own
  // style, so such a declaration is a rule in a small stylesheet Edityy adds for
  // that element. A rule is held under a key: "@" then the media condition, the
  // state, and the property — "@(max-width: 640px)|:hover|background".
  function ruleOf(key) {
    if (key.charAt(0) !== "@") return null;
    var parts = key.slice(1).split("|");
    return parts.length === 3 ? { when: parts[0], on: parts[1], property: parts[2] } : null;
  }

  /** The key a variation's declaration is written under: its own style, or its rule. */
  function propKey(declaration) {
    if (!declaration.on && !declaration.when) return declaration.property;
    return "@" + (declaration.when || "") + "|" + (declaration.on || "") + "|" + declaration.property;
  }

  /** What a property holds now: its inline value, or the rule in the sheet. */
  function readProp(rec, prop) {
    if (ruleOf(prop)) return rec.rules[prop] || "";
    return rec.el.style.getPropertyValue(prop);
  }

  /** Write one property: the element's own style, or the rule that names it. */
  function writeProp(rec, prop, value) {
    if (ruleOf(prop)) {
      if (value) rec.rules[prop] = value;
      else delete rec.rules[prop];
      drawRules(rec);
      return;
    }
    // `value` is a string, and "" means "not set": removeProperty empties it
    // without leaving a declaration behind, while setProperty("") would write one
    // that overrides the stylesheet with nothing.
    if (value) rec.el.style.setProperty(prop, value);
    else rec.el.style.removeProperty(prop);
  }

  /**
   * Draw the rules an element holds into its own stylesheet, or take the sheet
   * away when it holds none. One block for each state and breakpoint.
   *
   * shortcut: the sheet is the last one in the head, so a page that injects its
   * own rule for the same element afterwards wins; upgrade by appending the rule
   * with the element's id.
   */
  function drawRules(rec) {
    var keys = Object.keys(rec.rules);
    if (!keys.length) {
      if (rec.sheet && rec.sheet.parentElement) rec.sheet.parentElement.removeChild(rec.sheet);
      rec.sheet = null;
      return;
    }
    if (!rec.sheet) {
      rec.sheet = document.createElement("style");
      rec.sheet.setAttribute("data-edityy-variation", "");
      (document.head || document.body).appendChild(rec.sheet);
    }
    var selector = rec.selector || selectorFor(rec.el);
    var groups = [];
    var at = {};
    keys.forEach(function (key) {
      var rule = ruleOf(key);
      var id = rule.when + "|" + rule.on;
      if (!at[id]) {
        at[id] = { when: rule.when, on: rule.on, decls: [] };
        groups.push(at[id]);
      }
      at[id].decls.push(rule.property + ": " + rec.rules[key]);
    });
    rec.sheet.textContent = groups.map(function (group) {
      var block = selector + group.on + "{" + group.decls.join("; ") + "}";
      return group.when ? "@media " + group.when + "{" + block + "}" : block;
    }).join("\n");
  }

  /** The change record for an element, created on first touch. */
  function record(el) {
    for (var i = 0; i < changes.length; i++) {
      if (changes[i].el === el) return changes[i];
    }
    var rec = { el: el, props: {}, set: {}, was: {}, rules: {}, text: null, layoutMode: null, created: false };
    changes.push(rec);
    return rec;
  }

  /**
   * The backend for a change: note what was there, then set the new value.
   *
   * The record remembers the value before, and "before" has to include whether
   * the property was set at all. getPropertyValue() returns "" for both a
   * property that is unset and one set to nothing, so the inline declaration is
   * also read straight off the cssText — without that a width of 0 would be
   * recorded as nothing to put back and exit would leave it behind.
   */
  function apply(prop, value) {
    return applyTo(selected, prop, value);
  }

  /** apply(), for an element that is not the selection: a variation writes there. */
  function applyTo(el, prop, value) {
    var rec = record(el);
    remember(rec, prop);
    var was = readProp(rec, prop);
    writeProp(rec, prop, value);
    step(rec, prop, was, readProp(rec, prop));
    return rec;
  }

  /* -------------------------------------------------------------- history */

  // Undo and redo, as a stack of steps. A step is one element and the inline
  // values of the properties it touched, before and after:
  //   { rec, before: {prop: value}, after: {prop: value}, at }
  var history = [];
  var future = [];
  // The step this task's writes go into. A control can write two properties
  // for one input (a border's width and its style), and those are one step.
  var current = null;
  // When the words were last typed into: the browser owns the text's own undo,
  // so ⌘Z after typing is the browser's and ⌘Z after a drag is ours.
  var typedAt = 0;
  var editingTextBefore = "";
  // A drag fires an input per pixel, and typing "40" fires two. A slider, a
  // number or a colour holds its step open from the first input to the
  // `change` the browser fires when the drag lets go, so the whole gesture is
  // one step. A click on an option is a gesture of its own.
  var dragging = false;

  /** A continuous control is moving: what it writes joins the open step. */
  function hold() {
    dragging = true;
  }

  /** The drag let go, or the user moved on: the next write is a new step. */
  function release() {
    dragging = false;
    var top = history[history.length - 1];
    if (top) top.open = false;
  }

  function step(rec, prop, before, after) {
    var now = Date.now();
    if (!current) {
      var top = history[history.length - 1];
      current = top && top.open && top.rec === rec && prop in top.before ? top : null;
      if (!current) {
        if (top) top.open = false;
        current = { rec: rec, before: {}, after: {}, at: now, open: dragging };
        history.push(current);
      }
      // Closed at the end of this task, so the next input starts fresh.
      Promise.resolve().then(function () { current = null; });
    }
    if (!(prop in current.before)) current.before[prop] = before;
    current.after[prop] = after;
    current.at = now;
    future = [];
  }

  /** Record one non-style action in the same undo stack as property edits. */
  function action(rec, kind, before, after) {
    history.push({ rec: rec, kind: kind, before: before, after: after, at: Date.now() });
    future = [];
  }

  /** Write a step back without recording anything. */
  function replay(target, value) {
    if (target.kind === "text") {
      target.rec.el.textContent = value;
    } else if (target.kind === "move" || target.kind === "delete") {
      if (target.rec.fade) {
        target.rec.fade.cancel();
        target.rec.fade = null;
      }
      if (value) value.parent.insertBefore(target.rec.el, value.before && value.before.parentElement === value.parent ? value.before : null);
      else if (target.rec.el.parentElement) target.rec.el.parentElement.removeChild(target.rec.el);
      if (target.kind === "delete") target.rec.removed = value ? null : target.before;
    } else {
      Object.keys(value).forEach(function (prop) {
        writeProp(target.rec, prop, value[prop]);
      });
    }
    refit();
    tally();
    // The row wears the element's own values — a grid's counts, an absolute
    // element's offsets — so a reverted selection is drawn again. An open
    // control shows the value it read when it opened, so it is redrawn too.
    if (selected && target.rec.el === selected) buildRow();
    if (openKey && openKey !== "+") show(openKey);
  }

  function undo() {
    var last = history.pop();
    if (!last) return false;
    replay(last, last.before);
    future.push(last);
    return true;
  }

  function redo() {
    var next = future.pop();
    if (!next) return false;
    replay(next, next.after);
    history.push(next);
    return true;
  }

  /** A reverted element takes its steps with it: there is nothing left to undo. */
  function forget(rec) {
    var keep = function (x) { return x.rec !== rec; };
    history = history.filter(keep);
    future = future.filter(keep);
  }

  /* ---------------------------------------------------------- text editing */

  /**
   * Put the caret in an element's own words.
   *
   * Only leaf text — an element with child elements is left alone, because
   * a textContent rewrite would destroy them. The before value is recorded so
   * revert() still knows what the page said before this session touched it.
   *
   * `plaintext-only` and not `true`: pasting a word must not paste a <span> with
   * a style on it. A browser that does not know the value still types, because
   * it reads an unknown value as editable.
   *
   * Only an element with words of its own gets a caret: one with nothing but
   * child elements — a wrapper around a card — has nothing to type into. Child
   * elements inside it are no bar: the words are edited in place and the markup
   * is put back on exit, so a link inside a paragraph keeps its words.
   */
  function editText(el) {
    if (editing && editing !== el) stopEditing();
    if (!el || !canEditText(el)) return;
    // The before value is taken WITHOUT writing it back. Assigning textContent
    // destroys the text node and builds a new one, so the browser loses the caret
    // it was about to be given. Nothing is written here; the browser mutates the
    // node itself once it is editable. The record is told the before value so
    // revert() can put it back, but the text is only READ.
    var rec = record(el);
    editingTextBefore = el.textContent;
    if (rec.text === null) rec.text = el.textContent;
    // The markup as well as the words, because the browser can take a child
    // element out while the caret is in the words. This is what exit puts back.
    if (rec.html === undefined) rec.html = el.innerHTML;
    el.setAttribute("contenteditable", "plaintext-only");
    // No focus ring. The browser draws one on any focused element, and on the
    // words being edited it lands as a second outline right on top of the frame
    // Edityy already draws — so the element gets two rings, one of them not
    // ours. Set inline because this element is the page's, not ours: a rule in
    // the shadow root cannot reach it, and a class would change the page.
    // outline: none rather than a custom ring, because the frame is the ring.
    //
    // The outline the element had is recorded first, before ours goes on: the
    // record's "before" is what exit puts back, and it must be the page's, not
    // the `none` this line is about to write.
    remember(rec, "outline");
    el.style.setProperty("outline", "none");
    editing = el;
    if (el.focus) el.focus();
    // The caret goes to the end of the words, wherever the click landed: a click
    // near the start of a line must not decide where the typing begins.
    var range = document.createRange ? document.createRange() : null;
    var selection = window.getSelection ? window.getSelection() : null;
    if (range && selection) {
      range.selectNodeContents(el);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  /* ------------------------------------------------------------ edit text */

  /** Give the words back to the page: no longer editable, and no caret. */
  function stopEditing() {
    if (!editing) return;
    editing.removeAttribute("contenteditable");
    // The outline goes with it: back to exactly what the record says was there,
    // so an element that had an outline of its own gets it back.
    restore(record(editing), "outline");
    var top = history[history.length - 1];
    if (top && top.kind === "text" && top.rec === record(editing)) {
      top.open = false;
      if (top.before === top.after) history.pop();
    }
    if (editing.blur) editing.blur();
    editing = null;
    openDone = false; // the menu goes back to the actions it offers
  }

  /**
   * Note what a property was before this session first touched it. Only the
   * first time: after that the inline value is ours, not the page's.
   */
  function remember(rec, prop) {
    if (prop in rec.props) return;
    // A rule is ours alone: the page's own value for a state, a pseudo-element or
    // a breakpoint is not read, so there is nothing to put back but the rule.
    if (ruleOf(prop)) {
      rec.props[prop] = "";
      rec.set[prop] = false;
      rec.was[prop] = "";
      return;
    }
    // The computed value as well, for the edits list: the inline value before is
    // usually nothing at all, and "nothing → 40px" tells a reader very little.
    var view = window.getComputedStyle(rec.el);
    rec.was[prop] = view ? view.getPropertyValue(prop) : "";
    rec.props[prop] = rec.el.style.getPropertyValue(prop);
    rec.set[prop] = new RegExp("(?:^|;)\\s*" + prop + "\\s*:").test(rec.el.style.cssText);
  }

  /** Put one property back exactly as it was: its value, or not set at all. */
  function restore(rec, prop) {
    if (!(prop in rec.props)) return;
    if (rec.set[prop] && rec.props[prop]) writeProp(rec, prop, rec.props[prop]);
    else writeProp(rec, prop, "");
  }

  /** Undo every property and the text of one element. */
  function revert(rec) {
    // An element that was on its way out and is put back stops leaving: it
    // must not fade away in the reader's hand.
    if (rec.fade) {
      rec.fade.cancel();
      rec.fade = null;
      rec.el.style.opacity = "";
    }
    if (rec.location && rec.location.parent) {
      rec.location.parent.insertBefore(rec.el, rec.location.before && rec.location.before.parentElement === rec.location.parent ? rec.location.before : null);
    } else if (rec.removed && rec.removed.parent) {
      rec.removed.parent.insertBefore(rec.el, rec.removed.before && rec.removed.before.parentElement === rec.removed.parent ? rec.removed.before : null);
    }
    if (rec.created && rec.el.parentElement) {
      var parent = rec.el.parentElement;
      (rec.wrapped || []).slice().reverse().forEach(function (item) {
        parent.insertBefore(item.el, item.before && item.before.parentElement === parent ? item.before : null);
      });
      parent.removeChild(rec.el);
    }
    Object.keys(rec.props).forEach(function (prop) {
      restore(rec, prop);
    });
    if (rec.text !== null && rec.el.textContent !== rec.text) {
      // From the markup when there is one: textContent alone would flatten a
      // child element that was in the words — the link a paragraph was written
      // around — instead of putting it back.
      if (rec.html !== undefined) rec.el.innerHTML = rec.html;
      else rec.el.textContent = rec.text;
    }
    changes = changes.filter(function (other) {
      return other !== rec;
    });
    forget(rec);
    tally();
  }

  // The agreed line weight. Half of it stands off the element, so the line
  // straddles the element's own edge and its weight grows outwards as well as
  // inwards. The handle shapes that line sizes are the stylesheet's.
  var LINE = 1.5;

  /**
   * Put a frame on an element.
   *
   * The frame is put where the element is, at once. It follows the pointer,
   * and a frame that eases from one element to the next is a frame the
   * pointer has already left.
   */
  function place(frame, rect, el) {
    var box = {
      left: rect.left - LINE / 2 + "px",
      top: rect.top - LINE / 2 + "px",
      width: rect.width + LINE + "px",
      height: rect.height + LINE + "px",
    };
    if (frame === selBox) dropFrame(box);
    frame.style.left = box.left;
    frame.style.top = box.top;
    frame.style.width = box.width;
    frame.style.height = box.height;
    frame.style.setProperty("--frame", frameInk(el));
  }

  /**
   * The line colour for a frame: the ramp value that stands off what is behind
   * the element.
   *
   * Read from the nearest ancestor that paints a background, because most
   * elements are transparent and the colour the box touches is the one behind
   * them. A background image or a gradient is not read: a computed style holds
   * no pixel, so an element painted that way falls through to the page's own
   * paper, which is light.
   *
   * The frame wears the brand colour, the one hue the chrome paints itself
   * with. A page that hands the chrome a brand gets the frame in it.
   */
  function frameInk() {
    return chromeColour("--brand", "#d4a72c");
  }

  /**
   * Paint the text-colour chip with the colour the element actually has.
   *
   * Read from the element rather than painted in: the chip is a readout of this
   * site, and a fixed colour on it would be a lie about every site that is not
   * ours. Left transparent when the element has no hex colour of its own — a
   * name or an rgb() is a real colour, and the chip is honest about not being
   * able to show it rather than guessing.
   */
  function paintSwatch() {
    if (!selected) return;
    // Found by walking the row rather than by id: the chip is markup inside the
    // icon's own innerHTML, not an element of its own.
    var icon = slot("color");
    var bar = icon && icon.querySelector ? icon.querySelector("#swatch-color") : null;
    if (!bar) return;
    var current = get("color").trim();
    // The chip shows what the browser resolved the colour to, rgba() and all, so
    // a colour with any transparency is not drawn as a solid one. Anything that
    // is not an rgb() — a name, an hsl(), an oklch() — still falls through to
    // the hex, and is left transparent when there is no hex to show: the chip is
    // a readout, and a readout that guesses is a lie.
    bar.style.background = /^rgba?\(/.test(current) ? current : hex();
  }

  /**
   * The element's own colour as a hex, or "" when it cannot be one.
   *
   * There is nowhere left to read a hex from. `style.color` is normalised to
   * `rgb(0, 105, 92)` the moment it is set, and getComputedStyle only ever
   * answers in the same form — so the only way back to a hex is to convert, and
   * that is arithmetic on a value the page wrote, not a value we invented.
   *
   * Anything that is not a plain rgb/rgba is refused rather than guessed at: a
   * named colour, an hsl() or an oklch() would need a colour space this file
   * has no business implementing, and a swatch that lies about a site is worse
   * than a swatch that shows nothing.
   */
  function hex() {
    if (!selected) return "";
    var v = get("color").trim();
    var m = v.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
    if (!m) return "";
    return "#" + [m[1], m[2], m[3]].map(function (n) {
      // Clamped and rounded: a computed channel can be 254.9999, and a hex needs
      // a whole number or the browser will not take it.
      return ("0" + Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16)).slice(-2);
    }).join("");
  }

  /** Draw the selection frame and reveal whatever the new selection can edit. */
  function select(el, hit) {
    stopEditing();
    if (el) cardDoneFor = null;
    if (el !== selected) release();
    selected = el;
    selectedItems = el ? [el] : [];
    // The kind comes from the pick, because a form control is text by way of the
    // walk rather than by way of `kind()`: it has no text node of its own.
    selectedKind = el && hit ? hit.kind : null;
    syncSelectionFrames();
    syncDock();
    syncElementMenu();
    paintSwatch();
    paintMarks();
  }

  function syncSelectionFrames() {
    // The element being moved is off the page until it is placed, so it has no
    // box to frame: measured, it is a dot in the top-left corner.
    var items = moving ? [] : selectedItems;
    watchSelection(items);
    var count = items.length;
    var wasHidden = selBox.hidden;
    selBox.hidden = !count;
    // The frame arrives rather than appearing: a selection that pops on is a
    // selection that startles.
    if (wasHidden && !selBox.hidden) {
      animate(selBox, [{ opacity: 0 }, { opacity: 1 }], { duration: T.fade, easing: ARRIVE });
    }
    for (var i = 1; i < count; i++) {
      if (!extraSelectionFrames[i - 1]) {
        var frame = document.createElement("div");
        frame.className = "frame";
        root.appendChild(frame);
        extraSelectionFrames.push(frame);
      }
    }
    extraSelectionFrames.forEach(function (frame, i) { frame.hidden = i + 1 >= count; });
    items.forEach(function (el, i) {
      var frame = i === 0 ? selBox : extraSelectionFrames[i - 1];
      var rect = el.getBoundingClientRect();
      frame.className = "frame" + (rect.height < 40 ? " short" : "") + (rect.width < 40 ? " narrow" : "");
      place(frame, rect, el);
    });
  }

  // The element whose comment box is open, or null while the menu shows its
  // buttons. The box and the buttons are the same card, one at a time.
  var commentFor = null;
  var openComment = null;
  // The card is 90% of its old size. The scale moves every part together.
  var commentScale = 0.9;
  // The element whose card was closed on purpose. It stays shut until the next click.
  var cardDoneFor = null;
  // The buttons of the card, and the element they belong to. They are kept
  // between redraws: a card that is rebuilt on every scroll throws the row the
  // pointer is on away, and a card that rebuilds itself is a card that blinks.

  /**
   * Is a dock control open over the dock?
   *
   * The popover is the usual one. The size and weight controls carry a list of
   * their own inside the button, so that counts too — either way the dock has
   * the screen and the element menu waits.
   */
  function dockOpen() {
    if (openKey) return true;
    var lists = row.querySelectorAll(".custom-select-menu");
    for (var i = 0; i < lists.length; i++) {
      if (!lists[i].hidden) return true;
    }
    return false;
  }

  function syncElementMenu() {
    // The Add box owns the menu while its comment is open: no element needed.
    if (regionFor) {
      if (!openComment) drawMenu(commentBox({ region: regionFor }));
      placeAtRect(regionView(regionFor));
      return;
    }
    if (!active || !selected || selectedItems.length !== 1 || moving || dockOpen() || !activeTool) {
      commentFor = null;
      openComment = null;
      hideMenu();
      paintMarks();
      return;
    }
    if (cardDoneFor === selected) {
      commentFor = null;
      openComment = null;
      hideMenu();
      paintMarks();
      return;
    }
    if (commentFor && commentFor !== selected) {
      commentFor = null;
      openComment = null;
    }
    if (editing) {
      if (!openDone) {
        drawMenu(doneBox());
        openDone = true;
      }
      placeElementMenu();
      return;
    }
    // One box at a time. The click that selected the element opens its box.
    // While the strip shows the answer, the prompt stays put away.
    if (activeTool === "comment" && !commentFor && variantsBox.hidden) commentFor = selected;
    if (activeTool === "comment" && commentFor) {
      if (!openComment) drawMenu(commentBox({ el: commentFor }));
      placeElementMenu();
      return;
    }
    openComment = null;
    hideMenu();
    paintMarks();
  }
  /**
   * Put the element's card away: it fades out where it stands, the way it
   * came.
   */
  function hideMenu() {
    if (elementMenu.hidden) return;
    if (menuLeaving) return;
    if (!moves(elementMenu)) {
      elementMenu.hidden = true;
      return;
    }
    // The comment card wears scale(.9) in CSS; the animation must end
    // there, not at full size, or the card zooms out as it leaves.
    var base = elementMenu.querySelectorAll(".element-comment").length ? "scale(" + commentScale + ")" : "";
    var out = sink(elementMenu, base, 4);
    if (!out) {
      elementMenu.hidden = true;
      return;
    }
    // A card that is on its way out takes no clicks: it is leaving.
    elementMenu.style.pointerEvents = "none";
    menuLeaving = out;
    out.onfinish = function () {
      menuLeaving = null;
      elementMenu.hidden = true;
      out.cancel();
    };
  }

  /** Bring the card back: a fade that was leaving is put away. */
  function showMenu() {
    if (menuLeaving) {
      // The card is on its way out and is wanted back: it comes back from
      // where it is, not from where it was.
      animateFrom(
        elementMenu,
        [{ opacity: 1, transform: "none" }],
        { duration: T.enter, easing: ARRIVE }
      );
      menuLeaving.cancel();
      menuLeaving = null;
      elementMenu.style.pointerEvents = "";
      elementMenu.hidden = false;
      return;
    }
    elementMenu.style.pointerEvents = "";
    elementMenu.hidden = false;
  }

  /** Put the card away at once, with no fade. For the times it has to go now. */
  function menuAway() {
    if (menuLeaving) {
      menuLeaving.cancel();
      menuLeaving = null;
      elementMenu.style.pointerEvents = "";
    }
    elementMenu.hidden = true;
  }

  /**
   * Put a card in the element's menu.
   *
   * When the card is a different one from the one that was there, the new card
   * arrives. A card that swaps its whole contents under the reader's eyes is a
   * card that stutters, and the prompt card becoming the waiting card is the
   * biggest swap of them all.
   */
  function drawMenu(box) {
    var wasVisible = !elementMenu.hidden;
    // The same card again is not a new card: a card that is put back where it
    // was does not arrive again, or a scroll would set the card blinking.
    var changed = elementMenu.firstChild !== box;
    while (elementMenu.firstChild) elementMenu.removeChild(elementMenu.firstChild);
    elementMenu.appendChild(box);
    if (wasVisible && changed) {
      animate(
        box,
        [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }],
        { duration: T.enter, easing: ARRIVE }
      );
    }
  }

  // The comment card stands in one place: below its element, at the
  // element's left, and never above it. A card whose element scrolled
  // outside the viewport scrolls away: it is put away, and it returns
  // when the element returns. Other cards stand above or below, as room
  // allows, and never past the viewport edge.
  function placeAtRect(rect) {
    var isCommentCard = elementMenu.querySelectorAll(".element-comment").length > 0;
    if (isCommentCard && rect && (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth)) {
      hideMenu();
      return;
    }
    var appearing = elementMenu.hidden;
    showMenu();
    // The layout box keeps its full size under a scale: place by the size
    // the reader sees.
    var seen = elementMenu.querySelectorAll(".element-comment").length ? commentScale : 1;
    var width = (elementMenu.offsetWidth || 280) * seen;
    var height = (elementMenu.offsetHeight || 92) * seen;
    var left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    // The card stands above the dock, never on it: it is drawn over the dock,
    // so a card that came down onto the dock would take its clicks. Where the
    // two do not share a column, the bottom of the viewport is the floor.
    var floor = window.innerHeight - 12;
    var dockBox = dock.hidden ? null : dock.getBoundingClientRect();
    if (dockBox && dockBox.width && left < dockBox.right && left + width > dockBox.left) {
      floor = Math.min(floor, dockBox.top - 8);
    }
    var below;
    var top;
    if (isCommentCard) {
      below = true;
      top = rect.bottom + 8;
    } else {
      below = rect.bottom + 8 + height <= floor;
      top = below ? rect.bottom + 8 : rect.top - height - 8;
    }
    elementMenu.style.left = left + "px";
    elementMenu.style.top = Math.max(12, Math.min(top, floor - height)) + "px";
    // It comes out of the element: down from it when it is below, up from it
    // when it is above. Only when it appears; a refit on scroll just places it.
    // The comment card wears scale(.9) in CSS; rise must end there, not at
    // full size, or the card zooms in as it arrives.
    if (appearing) rise(elementMenu, seen === 1 ? "" : "scale(" + seen + ")", below ? -6 : 6, below ? "0 0" : "0 100%");
  }

  /** The menu at the selected element. */
  function placeElementMenu() {
    if (!selected) return;
    placeAtRect(selected.getBoundingClientRect());
  }

  /** A saved box as a viewport rect: page distances minus the scroll. */
  function regionView(region) {
    var x = window.pageXOffset || window.scrollX || 0;
    var y = window.pageYOffset || window.scrollY || 0;
    return {
      left: region.left - x,
      top: region.top - y,
      right: region.left - x + region.width,
      bottom: region.top - y + region.height
    };
  }

  /**
   * The one comment box: for one element or one drawn box. A field,
   * the temporary-canvas tick, preset chips, Cancel and Save.
   *
   * A drawn box has no element to vary, so its box has no chips: Save
   * saves the words on the box itself. An element's box carries the
   * chips: 1 makes a single edit, so Save writes the words onto the
   * element's record and the comment travels with the edits to the
   * agent's Markdown and to the saved file. Above 1, Save asks the
   * agent to explore that many variations of the element instead, and
   * the strip at the bottom right shows the answer.
   */
  function commentBox(target) {
    var el = target.el || null;
    var region = target.region || null;
    var box = document.createElement("div");
    box.className = "element-comment";
    var area = document.createElement("textarea");
    area.className = "element-comment-text";
    area.rows = 3;
    area.placeholder = "Comment";
    area.setAttribute("aria-label", "Comment");
    area.value = region ? region.comment || "" : variationPrompt || record(el).comment || "";
    box.appendChild(area);
    // The tick decides whether the change previews on a temporary canvas
    // first.
    var canvasRow = document.createElement("label");
    canvasRow.className = "element-comment-row";
    var canvasTick = document.createElement("input");
    canvasTick.type = "checkbox";
    canvasTick.className = "tick";
    canvasTick.setAttribute("aria-label", "Apply on temporary canvas");
    // The tick starts on: the change previews on the temporary canvas.
    canvasTick.checked = true;
    canvasRow.appendChild(canvasTick);
    var mark = document.createElement("span");
    mark.className = "element-comment-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.innerHTML = svg("check");
    canvasRow.appendChild(mark);
    var words = document.createElement("span");
    words.className = "element-comment-switch-words";
    var wordsTitle = document.createElement("span");
    wordsTitle.appendChild(text("Apply on temporary canvas"));
    words.appendChild(wordsTitle);
    canvasRow.appendChild(words);
    box.appendChild(canvasRow);
    // The chips decide what Save does. 1 makes a single edit; above 1,
    // Save asks the agent to explore that many variations. The Add box is
    // the same card: a drawn box has no element to vary, so its chips
    // above 1 stay off and Save keeps the words on the box itself.
    var count = 1;
    var modes = document.createElement("div");
    modes.className = "element-comment-modes";
    var chips = document.createElement("div");
    chips.className = "element-comment-chips";
    chips.setAttribute("role", "radiogroup");
    chips.setAttribute("aria-label", "How many");
    modes.appendChild(chips);
    // The counts live in an array of their own, not in the chips' words:
    // the words are for the reader, the array is for the choice.
    var counts = [1, 2, 5, 10];
    var chipButtons = counts.map(function (n) {
      var chip = button("element-comment-chip", "", n === 1 ? "Single edit" : n + " variations", function () { setCount(n); }, "comment-count-" + n);
      chip.setAttribute("role", "radio");
      chip.setAttribute("aria-checked", String(n === count));
      chip.tabIndex = n === count ? 0 : -1;
      // A drawn box has no element to vary: only the single edit stays on.
      if (!el && n !== 1) {
        chip.disabled = true;
        chip.title = "A drawn box has no element to vary";
      }
      chip.appendChild(text(String(n)));
      chips.appendChild(chip);
      return chip;
    });
    // The arrow keys move between the chips, like a radio group does.
    // Off chips are skipped: a drawn box keeps the single edit.
    chips.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var at = chipButtons.indexOf(document.activeElement);
      if (at < 0) return;
      var dir = e.key === "ArrowRight" ? 1 : chipButtons.length - 1;
      var idx = (at + dir) % chipButtons.length;
      var guard = 0;
      while (chipButtons[idx].disabled && guard++ < chipButtons.length) idx = (idx + dir) % chipButtons.length;
      var next = chipButtons[idx];
      if (next.disabled) return;
      setCount(counts[idx]);
      if (next.focus) next.focus();
    });
    // The chips line sits at the top of the card, above the comment field.
    box.insertBefore(modes, area);
    function setCount(next) {
      var idx = counts.indexOf(next);
      if (idx === -1 || chipButtons[idx].disabled) return;
      count = next;
      chipButtons.forEach(function (chip, i) {
        var on = counts[i] === next;
        chip.setAttribute("aria-checked", String(on));
        chip.tabIndex = on ? 0 : -1;
      });
    }
    if (el && variationWords) box.appendChild(noteBox(variationWords));
    openComment = box;
    var actions = document.createElement("div");
    actions.className = "element-menu-actions";
    var save = button("element-action element-comment-action", "", "Save comment", function () {
      var words = area.value.trim();
      if (!words) return;
      if (region) {
        region.comment = words;
        if (region.mark == null) region.mark = markTop++;
        if (regions.indexOf(region) === -1) regions.push(region);
        regionFor = null;
        openComment = null;
        hideMenu();
        regionBox.hidden = true;
        tally();
        return;
      }
      var n = count;
      if (n > 1) {
        variationPrompt = words;
        variationWords = "Asking your agent\u2026";
        cardDoneFor = null;
        openComment = null;
        syncElementMenu();
        requestVariations(el, n, variationPrompt, function (problem) {
          variationWords = problem;
          openComment = null;
          syncElementMenu();
        });
        return;
      }
      var rec = record(el);
      rec.comment = words;
      variationPrompt = "";
      variationWords = "";
      commentFor = null;
      openComment = null;
      cardDoneFor = el;
      syncElementMenu();
      tally();
    }, "comment-save");
    save.appendChild(text("Save"));
    // Cancel drops the drawn box, or puts the element's card away: what the
    // X did, now left of Save.
    var cancel = button("element-action element-comment-action", "", el ? "Cancel the comment" : "Drop the drawn box", function () {
      if (region) {
        regionFor = null;
        openComment = null;
        regionBox.hidden = true;
        hideMenu();
        paintMarks();
        return;
      }
      closeVariants();
      variationPrompt = "";
      commentFor = null;
      openComment = null;
      cardDoneFor = el;
      syncElementMenu();
    }, "comment-cancel");
    cancel.appendChild(text("Cancel"));
    actions.appendChild(cancel);
    // A comment is required: no words, no save.
    save.disabled = !area.value.trim();
    area.addEventListener("input", function () { save.disabled = !area.value.trim(); });
    actions.appendChild(save);
    box.appendChild(actions);
    // A box opened by a click is ready to type into.
    setTimeout(function () { if (area.focus) area.focus(); }, 0);
    return box;
  }

  function deleteSelected() {
    if (!selected || !selected.parentElement) return;
    var el = selected;
    var rec = record(el);
    // Where the element was when the page loaded, which is where the code puts
    // it: a delete after a move must not name the moved place.
    if (!rec.selector) {
      rec.selector = selectorFor(el);
      rec.source = sourceOf(el);
    }
    rec.removed = { parent: el.parentElement, before: el.nextSibling };
    action(rec, "delete", rec.removed, null);
    // The element leaves the way it came. Only its opacity is touched, and the
    // value it had is put back, so an undo brings the element back as it was.
    var was = el.style.opacity;
    if (!moves(el)) {
      el.parentElement.removeChild(el);
      select(null);
      tally();
      return;
    }
    // The fade is on the record, so an undo can stop it: an element that came
    // back while it was fading would fade on without the reader's asking.
    var fade = animate(el, [{ opacity: 1 }, { opacity: 0 }], { duration: T.fade, easing: LEAVE });
    rec.fade = fade;
    fade.onfinish = function () {
      rec.fade = null;
      // The element came back while it was fading: an undo put it back, and
      // it stays.
      if (changes.indexOf(rec) === -1) {
        el.style.opacity = was;
        return;
      }
      el.style.opacity = was;
      if (el.parentElement) el.parentElement.removeChild(el);
      select(null);
      tally();
    };
  }

  function extendSelection(el) {
    if (!el) return select(null);
    stopEditing();
    var index = selectedItems.indexOf(el);
    if (index !== -1) selectedItems.splice(index, 1);
    else selectedItems.push(el);
    selected = selectedItems[0] || null;
    selectedKind = selected ? kind(selected) : null;
    syncSelectionFrames();
    syncDock();
    syncElementMenu();
  }

  // What is selected, and what it was classified as. The seam any UI starts
  // from, so it stays.
  root.selection = function () {
    return selected ? { el: selected, kind: selectedKind } : null;
  };

  /* ------------------------------------------------------------ text dock */

  /**
   * The seven type controls, as data.
   *
   * `open` builds the control for that one key; the rest render nothing. So
   * opening a control is one function call and the popover starts empty, which
   * is why only one can ever be on screen.
   */
  /** The families a browser can always draw, used only as a floor. */
var SYSTEM_FONTS = [
  { label: "System UI", stack: "system-ui,-apple-system,Segoe UI,sans-serif" },
  { label: "Helvetica", stack: "Helvetica,Arial,sans-serif" },
  { label: "Georgia", stack: "Georgia,Cambria,serif" },
  { label: "Times New Roman", stack: '"Times New Roman",Times,serif' },
  { label: "Courier New", stack: '"Courier New",Courier,monospace' },
];
// Generic families and vendor prefixes: never a deliberate choice, never
// measurable, and not worth a row in the list.
var GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-[\w-]+|math|emoji|fangsong)$/;

/** One family name out of a stack: no quotes, no fallbacks. */
function faceName(stack) {
  return String(stack).split(",")[0].replace(/["']/g, "").trim();
}

/**
 * The families this page actually has, found by measuring rather than guessing.
 *
 * Edityy runs on other codebases, so no list of fonts can be baked in: the brand
 * face of the site being edited is the one worth offering and it is never the
 * same twice. Every name the page declares is checked against a width probe and
 * dropped unless the browser really draws it, because a name that is declared
 * but not loaded would silently fall back to something else when picked.
 *
 * Whatever the page declares or loads is offered first; the system families are
 * only a floor, so the list is never empty on a page that names no fonts at all.
 */
function faces() {
  var out = [];
  var seen = {};
  var add = function (label, stack, value) {
    if (!label || seen[label]) return;
    seen[label] = true;
    // `v` is what picking the row writes, so it has to be the full stack and not
    // the name: "Helvetica" alone resolves differently from "Helvetica,Arial".
    out.push({ label: label, stack: stack, v: value });
  };

  // A span of text, measured twice: once in a fallback, once in the candidate. A
  // different width is proof the face exists. Hidden off-screen so it never
  // shows and never reflows the page.
  var probe = document.createElement("span");
  probe.style.cssText =
    "position:absolute;left:-9999px;top:-9999px;font-size:100px;white-space:nowrap;visibility:hidden";
  probe.textContent = "Handgloves 0123";
  document.body.appendChild(probe);

  var measure = function (stack) {
    probe.style.fontFamily = stack;
    return probe.getBoundingClientRect().width;
  };
  // Every measure forces a layout, so the fallback is measured once and each
  // name once: document.fonts holds a face per weight, style and subset, and a
  // Google family alone can be a hundred of them.
  var base;
  var available = function (label) {
    if (base === undefined) base = measure("monospace");
    return measure(JSON.stringify(label) + ",monospace") !== base;
  };

  try {
    // Declared by the page or by the selected element, loaded webfonts, then the
    // system floor. Order is what the user sees: the site first, the machine last.
    var names = String(get("font-family") || "").split(",");
    var page = viewOf(document.documentElement);
    names = names.concat(String(page.fontFamily || "").split(","));

    // document.fonts is the reliable list; the stylesheets are read as well
    // because a cross-origin sheet throws on cssRules and a @font-face is the
    // one place a loaded face can otherwise hide from the API.
    try {
      Array.prototype.forEach.call(document.fonts || [], function (face) {
        names.push(face.family);
      });
    } catch {
      /* no FontFaceSet: the stylesheets below are the whole story */
    }
    for (var i = 0; i < document.styleSheets.length; i++) {
      var rules;
      try {
        rules = document.styleSheets[i].cssRules;
      } catch {
        continue; // cross-origin: nothing to read, and nothing to fail on
      }
      for (var j = 0; rules && j < rules.length; j++) {
        if (rules[j].type === 5) names.push(rules[j].style.getPropertyValue("font-family"));
      }
    }
    SYSTEM_FONTS.forEach(function (f) { names.push(f.label); });

    var checked = {};
    names.forEach(function (name) {
      var label = faceName(name);
      // Generics and the vendor prefixes are never a face anyone picked on
      // purpose, and none of them can be measured.
      if (!label || GENERIC.test(label) || checked[label]) return;
      checked[label] = true;
      // A Google font drawn only as a sample of its own name is not the page's:
      // it has a few letters and it lives in the catalog below.
      if (previewed[label] && !loaded[label]) return;
      if (available(label)) add(label, label, label);
    });
  } finally {
    probe.remove();
  }

  // The floor, in case a page declares nothing a probe can measure.
  SYSTEM_FONTS.forEach(function (f) { add(f.label, f.stack, f.stack); });
  return out;
}

  /* ------------------------------------------------------- Google Fonts */

  // The Google Fonts catalog, after the page's own faces. None of it loads with
  // the page: the names are fetched the first time the family control opens,
  // and a font file only when its row is drawn or picked. Fontsource serves the
  // names with CORS and no API key; Google serves the files.
  var CATALOG_URL = "https://api.fontsource.org/v1/fonts?type=google";
  var FONTS_CSS = "https://fonts.googleapis.com/css2?";
  // The most rows the list draws at one time. The catalog is near 2,000 names,
  // and a row is a button and a preview, so the search narrows it instead.
  var MAX_ROWS = 40;
  // The generic family for each category, so a face that has not arrived yet
  // falls back to one of the same kind.
  var GENERIC_FOR = { serif: "serif", monospace: "monospace", handwriting: "cursive" };

  var catalog = null; // the catalog request, made once per visit
  var sheets = {}; // stylesheet URL -> its load, so each URL is requested once
  var previewed = {}; // family -> true once a sample of its name is requested
  var loaded = {}; // family -> true once the whole family is requested
  var fontMeta = {}; // family -> available weight metadata

  /** The catalog, fetched once. A failure is forgotten, so the next open tries again. */
  function googleFonts() {
    if (!catalog) {
      catalog = (typeof fetch === "function" ? fetch(CATALOG_URL) : Promise.reject(new Error("no fetch")))
        .then(function (res) {
          if (!res.ok) throw new Error("Google Fonts catalog: HTTP " + res.status);
          return res.json();
        })
        .then(function (list) {
          var out = [];
          (Array.isArray(list) ? list : []).forEach(function (f) {
            // Icon fonts draw pictures, not words.
            if (!f || typeof f.family !== "string" || f.category === "icons") return;
            var stack = JSON.stringify(f.family) + "," + (GENERIC_FOR[f.category] || "sans-serif");
            // Only what a row needs. The rest of the record is dropped here.
            out.push({
              label: f.family,
              stack: stack,
              v: stack,
              key: f.family.toLowerCase(),
              google: true,
              weights: Array.isArray(f.weights) ? f.weights : [400],
              styles: Array.isArray(f.styles) ? f.styles : ["normal"],
              axes: Array.isArray(f.axes) ? f.axes : [],
            });
          });
          return out;
        });
      catalog.catch(function () {
        catalog = null;
      });
    }
    return catalog;
  }

  /** One stylesheet in the page head, requested once however often it is asked for. */
  function sheet(url) {
    if (!sheets[url]) {
      sheets[url] = new Promise(function (resolve, reject) {
        var link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = url;
        link.setAttribute("data-edityy-font", "");
        link.onload = resolve;
        link.onerror = function () {
          // Removed, so a later ask makes a new request and not a cached failure.
          link.remove();
          delete sheets[url];
          reject(new Error("Google Fonts stylesheet failed: " + url));
        };
        // @font-face has no effect inside a shadow root, so it goes in the page.
        (document.head || document.documentElement).appendChild(link);
      });
    }
    return sheets[url];
  }

  /** A family as css2 wants it: spaces as plus signs, the rest escaped. */
  function familyParam(name) {
    return "family=" + encodeURIComponent(name).replace(/%20/g, "+");
  }

  /**
   * Draw each row in its own face, for the cost of the letters in its name.
   *
   * One request for all the rows drawn together, and `text=` asks Google for
   * only those glyphs, so each file is a small part of the real font.
   */
  function previewFaces(items) {
    var fresh = items.filter(function (f) {
      return !previewed[f.label] && !loaded[f.label];
    });
    if (!fresh.length) return;
    var letters = {};
    fresh.forEach(function (f) {
      // Kept on failure as well: a sample is not worth a second request.
      previewed[f.label] = true;
      f.label.split("").forEach(function (c) { letters[c] = true; });
    });
    var url =
      FONTS_CSS +
      fresh.map(function (f) { return familyParam(f.label); }).join("&") +
      "&text=" + encodeURIComponent(Object.keys(letters).join("")) +
      "&display=swap";
    sheet(url).catch(function () {
      /* the rows stay in their fallback face */
    });
  }

  /**
   * The whole family, when it is picked: every weight and style it has. The
   * stylesheet only declares them; the browser downloads the files the page
   * then uses. If the full request fails, the regular face alone is tried.
   */
  function loadFamily(f) {
    loaded[f.label] = true;
    var weights = f.weights.slice().sort(function (a, b) { return a - b; });
    var ital = [];
    if (f.styles.indexOf("normal") !== -1 || f.styles.indexOf("italic") === -1) ital.push(0);
    if (f.styles.indexOf("italic") !== -1) ital.push(1);
    var tuples = [];
    ital.forEach(function (i) {
      weights.forEach(function (w) { tuples.push(i + "," + w); });
    });
    var axes = ital.indexOf(1) !== -1 ? ":ital,wght@" + tuples.join(";") : ":wght@" + weights.join(";");
    var family = FONTS_CSS + familyParam(f.label);
    return sheet(family + axes + "&display=swap")
      .catch(function () { return sheet(family + "&display=swap"); })
      .catch(function (e) {
        delete loaded[f.label];
        throw e;
      });
  }

  var ALIGNS = [
    { v: "left", label: "Align left", icon: "align-left" },
    { v: "center", label: "Align centre", icon: "align-center" },
    { v: "right", label: "Align right", icon: "align-right" },
    { v: "justify", label: "Justify", icon: "align-justify" },
  ];
  var DECORATIONS = [
    { v: "underline", label: "Underline", icon: "underline" },
    { v: "line-through", label: "Strikethrough", icon: "strikethrough" },
    { v: "italic", label: "Italic", icon: "italic" },
  ];

  // Container controls are mode-specific: the dock mirrors the layout table,
  // rather than showing one mixed panel whose controls change meaning.
  var MODES = ["flex", "grid", "absolute"];
  var DIRECTIONS = [
    { v: "row", label: "Row", icon: "arrow-right" },
    { v: "column", label: "Column", icon: "arrow-down" },
  ];
  var WRAPS = [
    { v: "nowrap", label: "No wrap", icon: "move-horizontal" },
    { v: "wrap", label: "Wrap", icon: "wrap-text" },
    { v: "wrap-reverse", label: "Wrap reverse", icon: "wrap-text" },
  ];
  // Alignment as one 3x3 grid: each cell is a justify/align pair, and the cell
  // is the whole control. The list is in the order of the grid, so the labels
  // run left to right along each row.
  var ALIGN_CELLS = [
    { v: "flex-start:flex-start", label: "Top left" },
    { v: "center:flex-start", label: "Top center" },
    { v: "flex-end:flex-start", label: "Top right" },
    { v: "flex-start:center", label: "Middle left" },
    { v: "center:center", label: "Center" },
    { v: "flex-end:center", label: "Middle right" },
    { v: "flex-start:flex-end", label: "Bottom left" },
    { v: "center:flex-end", label: "Bottom center" },
    { v: "flex-end:flex-end", label: "Bottom right" },
  ];

  var PAD_GLYPH = "expand";
  var MARGIN_GLYPH = "move-diagonal";
  // The `+`, and the controls it opens: the things that are not type.
  // Shown as options rather than five more icons in the dock, because the dock is
  // the controls you have and the `+` is the ones you might want.
  var ADD = [
    { key: "shadow", label: "Shadow", glyph: "layers" },

    // Fill and border are about the box, not the words: an element has a
    // background and a border, and its text has neither — a text fill is the
    // text colour, which is in the primary dock, and text has no border at all.
    { key: "fill", label: "Fill", glyph: "paint-bucket" },
    { key: "border", label: "Border", glyph: "square" },
    // Space, inside the box and around it. The base controls of anything that is
    // not text, and behind the `+` for text, whose padding matters too.
    { key: "padding", label: "Padding", glyph: PAD_GLYPH },
    { key: "margin", label: "Margin", glyph: MARGIN_GLYPH },
  ];

  // A media element's `+` offers opacity in place of the fill: an image has no
  // background of its own worth painting, and how much of it shows through is
  // the thing to add.
  var MEDIA_ADD = ADD.map(function (item) {
    return item.key === "fill" ? { key: "opacity", label: "Opacity", glyph: "droplet" } : item;
  });

  /** The controls an element of this kind can add with the `+`. */
  function addable() {
    return selectedKind === "media" ? MEDIA_ADD : ADD;
  }

  /** A button in the dock, or an option inside one control. */
  function button(cls, html, label, onClick, key) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.title = label;
    b.setAttribute("aria-label", label);
    b.dataset.key = key || "";
    // Markup goes in as a string so the browser's own parser creates the icons:
    // an SVG element cannot be made with createElement(), which only ever builds
    // HTML elements and would hand back an <svg> that draws nothing.
    b.innerHTML = html;
    b.addEventListener("click", onClick);
    return b;
  }

  /* ---------------------------------------------------------------- motion */

  // The curves and the durations, read from the tokens the chrome wears. A
  // page that sets its own --edityy-* tokens gets its own timing here too, so
  // the CSS and the animations started from here cannot disagree.
  function token(name, fallback) {
    var v = "";
    try {
      v = getComputedStyle(host).getPropertyValue(name);
    } catch {
      v = "";
    }
    return (v || "").trim() || fallback;
  }

  function ms(name, fallback) {
    var n = parseFloat(token(name, ""));
    return isNaN(n) ? fallback : n;
  }

  var ARRIVE = token("--arrive", EASE.arrive);
  var LEAVE = token("--leave", EASE.leave);
  var STANDARD = token("--standard", EASE.standard);
  var T = {
    press: ms("--press", TIME.press),
    fade: ms("--fade", TIME.fade),
    tint: ms("--tint", TIME.tint),
    slide: ms("--slide", TIME.slide),
    settle: ms("--settle", TIME.settle),
    enter: ms("--enter", TIME.enter),
    rise: ms("--rise", TIME.rise),
    move: ms("--move", TIME.move),
    pulse: ms("--pulse", TIME.pulse)
  };

  // The question of less motion, asked once and kept. A media query list is
  // live: it says yes now if the reader changed their mind since the last time.
  var lessMotion =
    typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  /** May this element animate? Not when the user asks for less motion, and not
   * in a browser without the Web Animations API, where it just changes. */
  function moves(el) {
    if (!el || typeof el.animate !== "function") return false;
    return !(lessMotion && lessMotion.matches);
  }

  /** Run `fn` in the next frame, or now where there are no frames. */
  function nextFrame(fn) {
    if (typeof window.requestAnimationFrame !== "function") return fn();
    window.requestAnimationFrame(fn);
  }

  /**
   * Bring a surface in that was hidden: it fades up and grows the last few
   * percent from `origin`. `base` is the transform the surface already wears, so
   * the animation ends exactly where the CSS puts it.
   */
  function rise(el, base, dy, origin) {
    if (!moves(el)) return;
    base = base || "";
    var from = (base + " translateY(" + dy + "px) scale(.96)").trim();
    el.style.transformOrigin = origin || "";
    var run = el.animate(
      [{ opacity: 0, transform: from }, { opacity: 1, transform: base || "none" }],
      { duration: T.enter, easing: ARRIVE }
    );
    // The origin belongs to the animation, not to the element: left behind, it
    // would be the origin of the next one, and the next one may want another.
    run.onfinish = function () {
      if (el.style.transformOrigin === (origin || "")) el.style.transformOrigin = "";
    };
  }

  /**
   * Take a surface away: it fades and falls, a little smaller than it was.
   * `base` is the transform the surface already wears.
   */
  function sink(el, base, dy) {
    if (!moves(el)) return null;
    base = base || "";
    var to = (base + " translateY(" + dy + "px) scale(.96)").trim();
    return el.animate(
      [{ opacity: 1, transform: base || "none" }, { opacity: 0, transform: to }],
      { duration: T.fade, easing: LEAVE, fill: "forwards" }
    );
  }

  /**
   * Animate from where the element is now, not from where it was.
   *
   * An animation that is interrupted — a tooltip still rising when the pointer
   * leaves, a label that changes twice — would otherwise jump to the start of
   * the next animation. This reads the value the element is showing now, the
   * running animation and all, and starts there.
   */
  function animateFrom(el, to, options) {
    if (!moves(el)) return null;
    var view = null;
    try {
      view = getComputedStyle(el);
    } catch {
      view = null;
    }
    var from = to[0];
    if (view) {
      from = {};
      Object.keys(to[0]).forEach(function (prop) {
        var v = view.getPropertyValue(prop);
        from[prop] = v === "" || v == null ? to[0][prop] : v;
      });
    }
    var frames = [from];
    to.forEach(function (frame) {
      frames.push(frame);
    });
    return el.animate(frames, options);
  }

  /**
   * The transform a tip has to start from to travel from `fromX` to `x`: where
   * it is now, moved back to the control it came from.
   *
   * The tip's own left is already the new one by the time it travels, so the
   * transform is what carries it back and then forward. It starts from the
   * transform the tip is showing now, rise and all, so a tip that is still
   * rising does not jump on its way across.
   *
   * The move back is written first, so it is a move in the page's own space
   * and not one the tip's current scale would shrink.
   */
  function travelFrom(fromX, x, current) {
    if (!current || current === "none") current = tip.style.transform || TIP_REST;
    return "translateX(" + (fromX - x) + "px) " + current;
  }

  /**
   * Where the tip is now: its opacity and its transform, as they are shown.
   *
   * Read before the running animation is stopped, because a stopped animation
   * puts the tip back to where its own style says, and that is not where the
   * reader is looking.
   */
  function tipNow() {
    var view = null;
    try {
      view = getComputedStyle(tip);
    } catch {
      view = null;
    }
    if (!view) return { opacity: 1, transform: "" };
    var opacity = parseFloat(view.getPropertyValue("opacity"));
    return {
      opacity: isNaN(opacity) ? 1 : opacity,
      transform: view.getPropertyValue("transform") || "",
    };
  }

  /**
   * Change the words on a button that answers a click (Copied, Saved). The old
   * words leave quickly and the new ones rise into the same place, so the button
   * itself never jumps.
   */
  function relabel(b, words) {
    var old = b.firstChild;
    if (!moves(b) || !old || typeof old.animate !== "function") {
      b.textContent = words;
      return;
    }
    var ticket = (b._relabel = (b._relabel || 0) + 1);
    // The old words leave from wherever they are: a relabel that lands while
    // the last one is still going does not make them jump back.
    animateFrom(
      old,
      [{ opacity: 0, transform: "translateY(-4px)" }],
      { duration: T.fade, easing: LEAVE, fill: "forwards" }
    ).onfinish = function () {
      // A later relabel owns the button now: leave its words alone.
      if (b._relabel !== ticket) return;
      var next = say(words);
      b.textContent = "";
      b.appendChild(next);
      animate(
        next,
        [{ opacity: 0, transform: "translateY(6px)", filter: "blur(2px)" }, { opacity: 1, transform: "none", filter: "blur(0px)" }],
        { duration: T.enter, easing: ARRIVE }
      );
    };
  }

  /** A button's words in their own box, so they can move without the button. */
  function say(words) {
    var span = document.createElement("span");
    span.className = "say";
    span.textContent = words;
    return span;
  }

  /** Run an animation with frames of its own. */
  function animate(el, frames, options) {
    if (!moves(el)) return null;
    return el.animate(frames, options);
  }

  /** A run of label text, as a text node. Anything that is not markup. */
  function text(value) {
    return document.createTextNode(value);
  }

  function canAutoLayout() {
    if (selectedItems.length < 2) return false;
    var parent = selectedItems[0].parentElement;
    return !!parent && selectedItems.every(function (el) { return el.parentElement === parent; });
  }

  function autoLayout() {
    if (!canAutoLayout()) return;
    var parent = selectedItems[0].parentElement;
    var ordered = Array.prototype.filter.call(parent.children, function (el) { return selectedItems.indexOf(el) !== -1; });
    // Each element's place in the code is read before the wrapper goes round it:
    // after, its selector runs through a div that is in no source file.
    var originalPositions = ordered.map(function (el) {
      var rec = record(el);
      if (!rec.selector) {
        rec.selector = selectorFor(el);
        rec.source = sourceOf(el);
      }
      return { el: el, before: el.nextSibling, selector: rec.selector };
    });
    var wrapper = document.createElement("div");
    wrapper.style.setProperty("display", "flex");
    wrapper.style.setProperty("flex-direction", "column");
    parent.insertBefore(wrapper, ordered[0]);
    ordered.forEach(function (el) { wrapper.appendChild(el); });
    var rec = record(wrapper);
    rec.created = true;
    rec.createdStyle = wrapper.style.cssText;
    rec.wrapped = originalPositions;
    show("");
    select(wrapper, { el: wrapper, kind: "container" });
    tally();
  }

  /**
   * Show one control over the menu, or nothing at all.
   *
   * The popover starts empty every time, so a closed control takes its DOM with
   * it and can never leave a stale listener behind.
   */
  function show(key) {
    // The panel rises under the control the pointer is on: the tooltip would
    // stand on top of it.
    hideTip(true);
    // The hint points at a value that is on its way out with the panel.
    hideHint();
    // One thing open at a time: a list drawn in the row closes with the control
    // that opens, because the two would stand in the same place.
    closeList();
    // A panel that is on its way out is brought back: the fade that was
    // leaving is put away, or it would hold the new words at nothing.
    if (popLeaving) {
      popLeaving.cancel();
      popLeaving = null;
    }
    // Was there a panel to leave? The copy is made before the panel is
    // emptied, so the old words are still there to be copied.
    var wasVisible = !pop.hidden && !!pop.firstChild;
    // A panel that is replaced leaves a copy behind: the old words stay while
    // the new ones arrive. A panel that closes leaves no copy, because a copy
    // in the dock would be invisible in the one case where the dock is going
    // too — so the panel itself fades out where it stands.
    //
    // A panel that shows the same control with new words in it is not
    // replaced: it is the same list with one more row, and a copy of it
    // fading away under the reader's eyes would be noise.
    var leaving = wasVisible && key && key !== openKey && moves(pop) ? ghostOf(pop) : null;
    var wasOpen = dockOpen();
    if (key !== openKey) release();
    openKey = key;
    if (typeof syncRow === "function") syncRow();
    // Dressed by data-key, not by position: the row is rebuilt per selection and
    // the added controls sit in front of the seven, so index i is not icon i.
    for (var i = 0; i < row.children.length; i++) {
      row.children[i].setAttribute("aria-expanded", row.children[i].dataset.key === key ? "true" : "false");
    }
    review.setAttribute("aria-expanded", key === "changes" ? "true" : "false");
    // The picker paints its own surface: HeroUI's white overlay, not the cream
    // the rest of the controls sit on. Named here are the controls the picker is
    // all of; a shadow keeps its own panel, with the picker standing in it.
    pop.className = key === "color" || key === "fill" || key === "border" ? "pop color" : "pop";
    // The menu comes back when the control closes, and stands down when one
    // opens. Only on that change: a redraw of an open control leaves the menu
    // exactly as it was.
    if (wasOpen !== dockOpen()) syncElementMenu();
    if (!key) {
      if (wasVisible && moves(pop)) {
        // The panel fades out where it stands, and is put away when it is gone.
        var out = sink(pop, "", 4);
        if (out) {
          popLeaving = out;
          out.onfinish = function () {
            popLeaving = null;
            pop.hidden = true;
            out.cancel();
          };
          return;
        }
      }
      // Emptied by hand rather than with innerHTML: children is a live HTMLCollection,
      // so it has to be copied before anything is removed from under it.
      while (pop.firstChild) pop.removeChild(pop.firstChild);
      pop.hidden = true;
      return;
    }
    // Emptied by hand rather than with innerHTML: children is a live HTMLCollection,
    // so it has to be copied before anything is removed from under it.
    while (pop.firstChild) pop.removeChild(pop.firstChild);
    pop.hidden = false;
    // `+` is not a control and is not in ICONS, so it needs its own way in. Every
    // other key is either one of the seven or one that the `+` just added, and
    // both are in CONTROLS by the time the row shows them.
    if (key === "+") addOne();
    else if (key === "changes") listChanges();
    else CONTROLS[key]();
    // The edits button is the dock's last stop, so its list goes after it in
    // the tab order, and Tab from the button steps into it. A row control's
    // panel stays in front of the row.
    var bar = review.parentElement;
    if (key === "changes") {
      if (dock.children[dock.children.length - 1] !== pop) dock.appendChild(pop);
    } else if (pop.nextSibling !== bar) dock.insertBefore(pop, bar);
    placePop(key);
    if (leaving) {
      // The old words go, the new ones arrive, and the two cross.
      leaving();
      enterPop();
    }
  }

  /**
   * The panel's own arrival, for the case the CSS keyframe cannot cover: the
   * panel was already open, and its content has been replaced. The keyframe
   * plays when the panel comes back from being hidden, not when its content
   * changes under it.
   */
  function enterPop() {
    animate(
      pop,
      [{ opacity: 0, transform: "translateY(6px) scale(.95)" }, { opacity: 1, transform: "none" }],
      { duration: T.enter, easing: ARRIVE }
    );
  }

  /**
   * Put the secondary dock where its control is.
   *
   * The first control of the row sends it to the left corner, the last to the
   * right corner. Any other control puts the centre of the dock on the centre
   * of the control. Measured, because the panel is as wide as its own content.
   */
  function placePop(key) {
    if (!pop.hidden) pop.style.left = "0px";
    if (pop.hidden || !key) return;
    var target = key === "changes" ? review : slot(key);
    if (!target || !target.getBoundingClientRect) return;
    var dockBox = dock.getBoundingClientRect();
    var box = target.getBoundingClientRect();
    var width = pop.offsetWidth || 0;
    var items = row.children;
    var left = box.left - dockBox.left + box.width / 2 - width / 2;
    if (target === items[0]) left = 0;
    else if (target === items[items.length - 1]) left = Math.max(0, dockBox.width - width);
    // On a narrow viewport the dock fills the width, and a panel set from its
    // control could still run off an edge: it stays 12px inside the viewport.
    left = Math.max(12 - dockBox.left, Math.min(left, window.innerWidth - 12 - width - dockBox.left));
    pop.style.left = left + "px";
    // The panel grows out of its control, wherever the panel itself lands.
    pop.style.transformOrigin = Math.round(box.left - dockBox.left + box.width / 2 - left) + "px 100%";
  }

  /**
   * The bar is drawn out of its right edge: the row, or the edits button when
   * there is nothing beside it yet.
   *
   * One motion for both, because it is one surface. It is never faded and never
   * scaled out of nothing: the bar holds its place, its left edge travels, and
   * the right edge it hangs from — the edits button — slides the half the bar
   * grew by. So it is never in two places at once, and the toolbar reads as the
   * edits bar extending rather than a second bar arriving.
   */
  function extendBar() {
    // How much of the bar is drawn out: the whole bar, grip and row, from
    // its right edge, so the bar arrives as one line.
    var grow = barEl.offsetWidth;
    if (!grow) return;
    animate(
      barEl,
      [
        { clipPath: "inset(0 0 0 " + grow + "px)", transform: "translateX(" + -grow / 2 + "px)" },
        { clipPath: "inset(0 0 0 0px)", transform: "none" },
      ],
      { duration: T.rise, easing: ARRIVE }
    );
  }

  /**
   * The open choreography, in the order it plays. The logo shrinks, the bar
   * draws out from its right edge, and the controls land on it one by one,
   * rightmost first, so they arrive in the direction the bar grew. `next`
   * runs when the shrink is done and the pill can hide. Where motion is not
   * allowed this runs at once, so less motion sees no sequence at all.
   *
   * Only the image shrinks, never the pill: the paper stays put and the mark
   * is what moves.
   */
  function shrinkLogo(next) {
    var done = animate(
      launchImg,
      [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(.6)", opacity: 0 }],
      { duration: T.settle, easing: STANDARD, fill: "forwards" }
    );
    if (!done) { next(); return; }
    done.onfinish = function () { done.cancel(); next(); };
  }

  /**
   * The controls land from the right, one half-press apart, as the bar is
   * drawing out: the first one starts while the bar is still growing, so
   * the row fills in as one wave rather than as clicks after a wait. Each
   * one waits at its small scale until its turn, so nothing pops in.
   */
  function staggerIn() {
    var items = Array.prototype.slice.call(row.children);
    for (var i = items.length - 1, step = 0; i >= 0; i--, step++) {
      animate(
        items[i],
        [{ opacity: 0, transform: "scale(.8)" }, { opacity: 1, transform: "none" }],
        { duration: T.enter, easing: ARRIVE, delay: T.slide + step * (T.press / 2), fill: "backwards" }
      );
    }
  }

  /**
   * The same wave out, in the same direction, before the bar goes: the
   * controls leave rightmost first, then `next` hides the dock. `next` runs
   * once at least one control has had time to leave, or at once where motion
   * is not allowed.
   */
  function staggerOut(next) {
    if (dock.hidden) { next(); return; }
    var items = Array.prototype.slice.call(row.children);
    var last = null;
    for (var i = items.length - 1, step = 0; i >= 0; i--, step++) {
      var run = animate(
        items[i],
        [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.8)" }],
        { duration: T.fade, easing: LEAVE, delay: step * (T.press / 2), fill: "backwards" }
      );
      // Each next run waits longer than the one before, so the last one the
      // loop starts is the last to land: it bounds the wait.
      if (run) last = run;
    }
    if (!last) { next(); return; }
    var waited = false;
    var fire = function () { if (!waited) { waited = true; next(); } };
    last.onfinish = fire;
    // A run that is cancelled fires no finish event, so the dock cannot be
    // left standing with no way home: the same timeout the ghost copy uses.
    setTimeout(fire, (items.length * (T.press / 2) + T.fade) * 2);
  }

  /**
   * The way back out of the chrome: the pill returns, and the logo grows
   * into it. The pill comes first, so the mark grows inside a surface that
   * is already there. Nothing grows where the mode is on again.
   */
  function restoreLogo() {
    if (active) return;
    launch.hidden = false;
    // The dock stood its ground for the whole way out, so the wave and the
    // fade played where the bar was. Only now, hidden, does it go home: the
    // next entry starts at the pill, wherever the pill is.
    unplaceDock();
    animate(
      launchImg,
      [{ transform: "scale(.6)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }],
      { duration: T.enter, easing: ARRIVE }
    );
  }

  /**
   * The toolbar follows the grip anywhere on the page. The dock is fixed, so
   * moving it is writing its left and top over the corner it stands in. The
   * pointer keeps the grip until it lets go, so the hand may cross the page
   * without the bar stopping. Exit clears the inline place, so the dock is
   * back in its corner the next time it stands up.
   */
  function placeDock(left, top) {
    var width = dock.offsetWidth || 0;
    var height = dock.offsetHeight || 0;
    var across = (window.innerWidth || 0) - width - 8;
    var down = (window.innerHeight || 0) - height - 8;
    dock.style.left = Math.max(8, Math.min(left, Math.max(8, across))) + "px";
    dock.style.top = Math.max(8, Math.min(top, Math.max(8, down))) + "px";
    dock.style.right = "auto";
    dock.style.bottom = "auto";
    dock.setAttribute("data-placed", "true");
  }
  function unplaceDock() {
    dock.style.left = "";
    dock.style.top = "";
    dock.style.right = "";
    dock.style.bottom = "";
    dock.removeAttribute("data-placed");
  }
  /** The pill stands where it is put, clamped to the page like the bar. */
  function placeLaunch(left, top) {
    var width = launch.offsetWidth || 0;
    var height = launch.offsetHeight || 0;
    var across = (window.innerWidth || 0) - width - 8;
    var down = (window.innerHeight || 0) - height - 8;
    launch.style.left = Math.max(8, Math.min(left, Math.max(8, across))) + "px";
    launch.style.top = Math.max(8, Math.min(top, Math.max(8, down))) + "px";
    launch.style.right = "auto";
    launch.style.bottom = "auto";
  }
  (function () {
    var held = false;
    var offX = 0;
    var offY = 0;
    gripBtn.addEventListener("pointerdown", function (e) {
      if (e.preventDefault) e.preventDefault();
      if (gripBtn.setPointerCapture && e.pointerId !== undefined) gripBtn.setPointerCapture(e.pointerId);
      var box = dock.getBoundingClientRect ? dock.getBoundingClientRect() : null;
      offX = box ? e.clientX - box.left : 0;
      offY = box ? e.clientY - box.top : 0;
      held = true;
    });
    gripBtn.addEventListener("pointermove", function (e) {
      if (held) placeDock(e.clientX - offX, e.clientY - offY);
    });
    function letGo() { held = false; }
    gripBtn.addEventListener("pointerup", letGo);
    gripBtn.addEventListener("pointercancel", letGo);
    // The keyboard moves the bar too: arrows walk it, so it is not pointer-only.
    gripBtn.addEventListener("keydown", function (e) {
      var step = e.shiftKey ? 1 : 24;
      var box = dock.getBoundingClientRect ? dock.getBoundingClientRect() : null;
      if (!box) return;
      var left = box.left;
      var top = box.top;
      if (e.key === "ArrowLeft") left -= step;
      else if (e.key === "ArrowRight") left += step;
      else if (e.key === "ArrowUp") top -= step;
      else if (e.key === "ArrowDown") top += step;
      else return;
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
      placeDock(left, top);
    });
  })();

  /**
   * A copy of the open panel, to fade out over the dock while the real one is
   * emptied. The panel is rebuilt from nothing each time it opens, so its
   * leaving has to be played on a copy. Call the result once the panel is empty.
   */
  function ghostOf(panel, into) {
    var ghost = panel.cloneNode(true);
    var lists = panel.querySelectorAll(".list");
    var tops = [];
    for (var i = 0; i < lists.length; i++) tops.push(lists[i].scrollTop);
    var top = panel.scrollTop;
    return function () {
      ghost.removeAttribute("id");
      var named = ghost.querySelectorAll("[id]");
      for (var j = 0; j < named.length; j++) named[j].removeAttribute("id");
      ghost.setAttribute("aria-hidden", "true");
      ghost.style.pointerEvents = "none";
      ghost.style.animation = "none";
      // Back where the panel is, not where it was opened: a panel that moved
      // takes its ghost with it, and insertBefore throws on a stale child.
      var home = panel.parentNode || into || dock;
      home.insertBefore(ghost, panel.parentNode === home ? panel : null);
      // The copy starts at the top: put each list back where the user left it.
      ghost.scrollTop = top;
      var copies = ghost.querySelectorAll(".list");
      for (var k = 0; k < copies.length && k < tops.length; k++) copies[k].scrollTop = tops[k];
      ghost.animate(
        [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(4px) scale(.97)" }],
        { duration: T.fade, easing: LEAVE, fill: "forwards" }
      );
      setTimeout(function () {
        if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
      }, T.fade + 40);
    };
  }

  /** The options a single control can choose from, with a tick on the current one. */
  function options(items, current, onPick) {
    var list = document.createElement("div");
    list.className = "list";
    items.forEach(function (item) {
      list.appendChild(option(item, current, onPick));
    });
    pop.appendChild(list);
  }

  /** One row of a list of options. `onPick` gets the value and the item. */
  function option(item, current, onPick) {
    // Every row writes item.v, whatever the control is: a list of faces and a
    // list of alignments are both just choices, and one that forgets its value
    // silently writes nothing at all.
    var value = item.v === undefined ? item.stack : item.v;
    var b = button("opt", "", item.label || value, function () {
      // Picking an option does not close anything. The control stays open on
      // purpose: comparing two weights or two faces means looking at the page
      // with the choices still in view, and a click that dismisses the list is
      // a click you have to make again before trying the next value.
      release();
      onPick(value, item);
      mark(value);
    }, value);
    // The label is added rather than passed in, because a face name is text and
    // text is a node — there is no markup to parse it out of.
    b.appendChild(text(item.label));
    // The row says its own name, so a title would say it twice: the second time
    // as a browser tooltip under the row the pointer is already on.
    b.title = "";
    // cssText rather than the property: a face stack is commas and quotes, and
    // the shorthand carries them through without the DOM re-parsing anything.
    // Only a face row has a stack: a weight or an alignment row has none, and
    // writing the word "undefined" into a style would be a lie either way.
    if (item.stack) b.style.cssText = "font-family:" + item.stack;
    b.setAttribute("aria-pressed", value === current ? "true" : "false");
    return b;
  }

  /**
   * The family control: the faces the page has, then the Google Fonts catalog,
   * with one search field over both.
   *
   * The page's faces show at once. The catalog arrives when its one request
   * does, and the list is drawn again then. At most MAX_ROWS rows are drawn,
   * and only those rows are previewed, so typing narrows the catalog and a
   * scroll never starts a download.
   */
  function familyControl() {
    var local = faces();
    var mine = {};
    local.forEach(function (f) { mine[f.label] = true; });
    var current = get("font-family");
    var google = null;
    var failed = false;
    var timer = 0;

    var find = document.createElement("input");
    find.type = "search";
    find.placeholder = "Search for more fonts";
    find.setAttribute("aria-label", "Search for more fonts");
    find.addEventListener("input", function () {
      // One draw for each pause in the typing, not for each key: a draw can
      // request previews.
      clearTimeout(timer);
      timer = setTimeout(draw, 120);
    });
    var list = document.createElement("div");
    list.className = "list";
    var note = document.createElement("p");
    note.className = "note";
    pop.appendChild(find);
    pop.appendChild(list);
    pop.appendChild(note);

    /** Is this control still the one on screen? A late answer must not draw into another. */
    function open() {
      return openKey === "family" && list.parentElement === pop;
    }

    function say(words) {
      note.textContent = words;
      note.hidden = !words;
    }

    function pick(value, item) {
      current = value;
      // The project does not load a Google font, so the report has to say which
      // pick was one. A later pick of a page or system face clears the mark.
      record(selected).googleFont = item.google ? item.label : null;
      set("font-family", value);
      if (item.google) fontMeta[item.label.toLowerCase()] = item;
      updateFamilyLabel();
      updateWeightButton();
      if (!item.google) return;
      loadFamily(item).catch(function () {
        if (open()) say(item.label + " did not load. The text shows in a fallback face.");
      });
    }

    function draw() {
      if (!open()) return;
      var q = String(find.value || "").trim().toLowerCase();
      var rows = local.filter(function (f) { return !q || f.label.toLowerCase().indexOf(q) !== -1; });
      // At rest the list is the faces the page has, and the face the element
      // wears now, even when the page does not declare it: a list without that
      // face offers no way back to it.
      var now = faceName(current);
      if (!q && now && !GENERIC.test(now) && !rows.some(function (f) { return f.label === now; })) {
        rows = [{ label: now, stack: current, v: current }].concat(rows);
      }
      var drawn = [];
      // The catalog answers a search, not an open: typing is how a user asks
      // for more faces than the page already has.
      for (var i = 0; q && google && i < google.length && rows.length < MAX_ROWS; i++) {
        var f = google[i];
        if (mine[f.label] || f.key.indexOf(q) === -1) continue;
        rows.push(f);
        drawn.push(f);
      }
      while (list.firstChild) list.removeChild(list.firstChild);
      rows.forEach(function (f) { list.appendChild(option(f, current, pick)); });
      previewFaces(drawn);
      if (failed) say("Google Fonts did not load. Close and open this control to try again.");
      else if (!google && q) say("Loading Google Fonts…");
      else if (!rows.length) say("No font has that name.");
      else say("");
    }

    draw();
    googleFonts().then(
      function (items) {
        google = items;
        items.forEach(function (item) { fontMeta[item.label.toLowerCase()] = item; });
        draw();
      },
      function () {
        failed = true;
        draw();
      }
    );
  }

  /** Update the visible family value without rebuilding the open control. */
  function updateFamilyLabel() {
    var b = slot("family");
    if (!b) return;
    var stack = get("font-family");
    var name = faceName(stack) || "System UI";
    // The button wears the face it names: which family is on is then a thing to
    // see rather than a thing to read.
    b.style.fontFamily = stack || "";
    while (b.firstChild) b.removeChild(b.firstChild);
    b.appendChild(text(name));
    b.setAttribute("aria-label", "Font family: " + name);
  }

  /** Return the weight choices the selected face exposes, if known. */
  function weightInfo() {
    var name = faceName(get("font-family")).toLowerCase();
    var meta = fontMeta[name];
    var axis;
    var values = [];
    var add = function (value) {
      var labels = { normal: 400, regular: 400, medium: 500, semibold: 600, "semi-bold": 600, bold: 700, heavy: 800, black: 900 };
      var parsed = labels[String(value).toLowerCase()] || Number(value);
      if (parsed > 0 && values.indexOf(parsed) === -1) values.push(parsed);
    };
    if (meta) {
      axis = (meta.axes || []).filter(function (item) {
        return (item.tag || item) === "wght";
      })[0];
      if (axis) return { kind: "variable", min: Number(axis.min) || 100, max: Number(axis.max) || 900 };
      if (meta.variable || meta.variation || meta.fontVariationSettings) return { kind: "variable", min: 100, max: 900 };
      (meta.weights || []).forEach(add);
    }
    try {
      Array.prototype.forEach.call(document.fonts || [], function (font) {
        if (String(font.family || "").replace(/[\"']/g, "").toLowerCase() !== name) return;
        String(font.weight || "").split(/\s+/).forEach(add);
      });
      for (var i = 0; i < document.styleSheets.length; i++) {
        var rules;
        try { rules = document.styleSheets[i].cssRules; } catch { continue; }
        for (var j = 0; rules && j < rules.length; j++) {
          if (rules[j].type !== 5) continue;
          var style = rules[j].style;
          var family = faceName(style.getPropertyValue("font-family")).toLowerCase();
          if (family !== name) continue;
          var weight = style.getPropertyValue("font-weight").trim();
          var range = weight.match(/^(\d+)\s+(\d+)$/);
          if (range) return { kind: "variable", min: Number(range[1]), max: Number(range[2]) };
          weight.split(/\s+/).forEach(add);
        }
      }
    } catch {
      /* FontFaceSet and stylesheet inspection are optional. */
    }
    values.sort(function (a, b) { return a - b; });
    return values.length > 1 ? { kind: "fixed", values: values } : { kind: "none" };
  }

  /** Update the weight control state when the selected family changes. */
  function updateWeightButton() {
    var b = slot("weight");
    if (!b) return;
    var info = weightInfo();
    b.disabled = info.kind === "none";
    b.setAttribute("aria-disabled", b.disabled ? "true" : "false");
    b.setAttribute("aria-label", b.disabled ? "Font weight is not available" : "Font weight");
  }

  /**
   * Paint a cycle button with the value the element has now.
   *
   * A cycle button has no control to open, so the button itself says which value
   * is on. An element without the property keeps its plain glyph.
   */
  function paintCycle(list, key, prop) {
    var value = String(get(prop) || "").trim();
    var item = list.filter(function (choice) { return choice.v === value; })[0];
    var b = item && slot(key);
    if (!b) return;
    b.innerHTML = svg(item.icon) + '<span class="lbl">' + item.label + "</span>";
    b.setAttribute("aria-label", item.label);
  }

  /** Cycle the text alignment directly from the primary dock. */
  function cycleAlignment() {
    if (!pop.hidden) show("");
    // An alignment nobody set computes to `start`, and `str.end` to `end`: the
    // browser names the sides of the writing mode, where this list names left and
    // right. Read as they are, neither is in the list, and the first click wrote
    // the alignment the element already had.
    var current = String(get("text-align") || "").trim() || "left";
    if (current === "start") current = "left";
    if (current === "end") current = "right";
    var at = ALIGNS.map(function (item) { return item.v; }).indexOf(current);
    var next = ALIGNS[(at + 1) % ALIGNS.length];
    reflow(selected, function () { set("text-align", next.v); });
    var b = slot("align");
    if (!b) return;
    b.innerHTML = svg(next.icon);
    b.setAttribute("aria-label", next.label);
  }

  /** Move the tick in an open control to whatever was just picked. */
  function mark(value) {
    for (var i = 0; i < pop.children.length; i++) {
      var rows = pop.children[i].children;
      for (var j = 0; rows && j < rows.length; j++) {
        // A control can hold anything, not only buttons — a label is a text node
        // and has no aria-pressed to move. Only an option carries one.
        if (rows[j].getAttribute && rows[j].getAttribute("aria-pressed") !== null) {
          rows[j].setAttribute("aria-pressed", rows[j].dataset.key === value ? "true" : "false");
        }
      }
    }
  }

  /**
 * A row of buttons, for alignment and decoration. A button may hold a glyph or
 * be an empty cell: the alignment grid is nine cells, and the cell is the mark.
 *
 * `onPick` returns the options that are now on, as a list, and the ticks follow
 * it: one item for a control that only allows one, several for decoration, which
 * CSS lets you stack.
 */
function icons(items, current, onPick, cls) {
    var list = document.createElement("div");
    list.className = cls ? "opts " + cls : "opts";
    var rows = items.map(function (item) {
      var b = button("ic", item.icon ? svg(item.icon) : "", item.label || item.v, function () {
        // Stays open like every other control: these are things you try twice,
        // and the tick moves so you can see which one is on.
        release();
        mark(onPick(item.v));
      }, item.v);
      list.appendChild(b);
      return b;
    });
    mark(current);
    function mark(on) {
      var picked = Array.isArray(on) ? on : [on];
      rows.forEach(function (b, i) {
        b.setAttribute("aria-pressed", picked.indexOf(items[i].v) === -1 ? "false" : "true");
      });
    }
    pop.appendChild(list);
    return mark;
  }

  /** The number a field holds, written back clean: a step of 0.1 must land on
      0.3, not on 0.30000000000000004. */
  function putNumber(input, next) {
    var step = Number(input.step) || 1;
    var min = input.min === "" ? -Infinity : Number(input.min);
    var max = input.max === "" ? Infinity : Number(input.max);
    next = Math.round(next / step) * step;
    next = Math.max(min, Math.min(max, next));
    var dot = String(step).indexOf(".");
    input.value = String(Number(next.toFixed(dot === -1 ? 0 : String(step).length - dot - 1)));
    // The field's own listeners write the edit, the same way typing does.
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /**
   * A number field that turns under the pointer. A wheel notch is one step and
   * the page does not scroll while the pointer is on the value; a sideways drag
   * is the fast way, 4px to a step; a click still puts the caret in to type.
   */
  function scrub(input) {
    var held = false; // the pointer is down on the value
    var dragged = false; // and it has moved far enough to mean a drag
    var fromX = 0;
    var fromValue = 0;
    var idle = 0;
    var step = function () { return Number(input.step) || 1; };

    input.addEventListener("pointerenter", function () { valueHint(input); });

    input.addEventListener("wheel", function (e) {
      if (!e.deltaY) return; // a sideways wheel belongs to the page
      e.preventDefault();
      clearTimeout(idle);
      hold();
      putNumber(input, (Number(input.value) || 0) + (e.deltaY < 0 ? step() : -step()));
      // A burst of notches is one undo step: it lets go when the wheel rests.
      idle = setTimeout(function () {
        release();
        settleBeat();
      }, 400);
    }, { passive: false });

    input.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      // The caret waits: a press that moves is a drag and a press that stays is
      // a click, so the two gestures can start the same way.
      e.preventDefault();
      held = true;
      dragged = false;
      fromX = e.clientX;
      fromValue = Number(input.value) || 0;
      if (input.setPointerCapture) input.setPointerCapture(e.pointerId);
    });

    input.addEventListener("pointermove", function (e) {
      if (!held) return;
      var dx = e.clientX - fromX;
      if (!dragged) {
        if (Math.abs(dx) < 3) return; // still a press, not a drag
        dragged = true;
        input.setAttribute("data-scrub", "");
      }
      hold();
      putNumber(input, fromValue + Math.round(dx / 4) * step());
    });

    function letGo() {
      if (!held) return;
      held = false;
      input.removeAttribute("data-scrub");
      if (dragged) {
        release();
        settleBeat();
        return;
      }
      // A click is the precise way: the value is taken whole, ready to type over.
      input.focus();
      // Chrome refuses a selection on a number field, so the pick is the best it
      // can do there; the caret still lands in the value.
      try {
        input.select();
      } catch {
        // No selection on this field type.
      }
    }
    input.addEventListener("pointerup", letGo);
    input.addEventListener("pointercancel", letGo);

    /**
     * The value has come to rest, and says so: a small beat, the same one the
     * edits count gives when it changes. A number that simply stops is a number
     * the reader has to check.
     */
    function settleBeat() {
      animate(
        input,
        [{ transform: "scale(1)" }, { transform: "scale(1.05)" }, { transform: "scale(1)" }],
        { duration: T.settle, easing: ARRIVE }
      );
    }
  }

  /** Put the hint away now, and stop it coming back on its own. */
  function hideHint() {
    clearTimeout(hintTimer);
    hint.hidden = true;
  }

  /** One line over the first number the pointer meets, for about a second. */
  function valueHint(input) {
    if (hintDone || !input.getBoundingClientRect) return;
    hintDone = true;
    var box = input.getBoundingClientRect();
    // Above the value, unless it stands near the top of the screen: a line that
    // runs off the edge says nothing.
    var above = box.top > 46;
    var rest = above ? TIP_REST : TIP_BELOW;
    hint.textContent = "Scroll to adjust";
    hint.dataset.side = above ? "top" : "bottom";
    hint.style.left = box.left + box.width / 2 + "px";
    hint.style.top = (above ? box.top - 8 : box.bottom + 8) + "px";
    hint.style.transform = rest;
    hint.hidden = false;
    if (moves(hint)) {
      animate(
        hint,
        [
          { opacity: 0, transform: rest + " translateY(" + (above ? 7 : -7) + "px) scale(.9)" },
          { opacity: 1, transform: rest },
        ],
        { duration: T.settle, easing: ARRIVE }
      );
    }
    hintTimer = setTimeout(function () {
      if (!moves(hint)) {
        hint.hidden = true;
        return;
      }
      var out = animateFrom(hint, [{ opacity: 0 }], { duration: T.fade, easing: LEAVE, fill: "forwards" });
      if (!out) {
        hint.hidden = true;
        return;
      }
      out.onfinish = function () {
        hint.hidden = true;
        out.cancel();
      };
    }, HINT_HOLD);
  }

  /**
   * A number field, for size, tracking, gaps and the rest. A label may be a
   * glyph instead of the word: the glyph stands where the word would, and the
   * word stays on the input, where a screen reader reads it. The field says the
   * number; a unit is the dock's own business, not a word beside every value.
   */
  function number(min, max, step, current, onInput, label, parent) {
    // The row is one chip, and the chip is the field: the glyph and the number
    // inside one hairline, the way the dock's size control holds both. It is a
    // label, so a press anywhere on the chip lands in the number and presses it.
    var row = document.createElement("label");
    row.className = "bar2 fld";
    if (label) {
      var caption = document.createElement("span");
      caption.className = "field-label";
      if (typeof label === "string") caption.textContent = label;
      else caption.innerHTML = svg(label.glyph);
      row.appendChild(caption);
    }
    var input = document.createElement("input");
    input.type = "number";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = current;
    if (label) input.setAttribute("aria-label", typeof label === "string" ? label : label.label);
    input.addEventListener("input", function () {
      // Blank while typing is not a value; wait for the field to be usable.
      if (input.value === "") return;
      hold();
      onInput(Number(input.value));
    });
    input.addEventListener("change", release);
    row.appendChild(input);
    scrub(input);
    (parent || pop).appendChild(row);
    return row;
  }

  /** The drawn list that is showing, if any: one thing open at a time. */
  var openList = null;

  /** Hide the list that is showing, so nothing else has to stand beside it. */
  function closeList() {
    var list = openList;
    openList = null;
    if (!list) return;
    if (moves(list)) {
      // The list leaves the way it came: a copy of it fades out where it
      // stood, and the list itself is put away at once.
      var ghost = ghostOf(list, list.parentElement);
      list.hidden = true;
      ghost();
      return;
    }
    list.hidden = true;
  }

  /** A custom list that keeps its value editable through the paired input.
      A `chevron` trigger is the arrow alone, for a list whose value is already
      in the field beside it: a trigger that repeats the value says it twice. */
  function customSelect(items, current, onPick, label, chevron) {
    var wrap = document.createElement("div");
    wrap.className = "custom-select";
    var trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "custom-select-trigger" + (chevron ? " chevron" : "");
    if (chevron) trigger.innerHTML = svg("chevron-up");
    else trigger.textContent = current;
    trigger.setAttribute("aria-label", label);
    var menu = document.createElement("div");
    menu.className = "custom-select-menu";
    menu.hidden = true;
    items.forEach(function (item) {
      var option = button("custom-option", "", item.label, function () {
        if (!chevron) trigger.textContent = item.label;
        menu.hidden = true;
        if (openList === menu) openList = null;
        for (var i = 0; i < menu.children.length; i++) {
          menu.children[i].setAttribute("aria-pressed", menu.children[i] === option ? "true" : "false");
        }
        onPick(item.value);
      }, String(item.value));
      option.appendChild(text(item.label));
      // Named by its own row: no second tooltip saying the same word.
      option.title = "";
      option.setAttribute("aria-pressed", String(item.value) === String(current) ? "true" : "false");
      menu.appendChild(option);
    });
    trigger.addEventListener("click", function (e) {
      if (e.stopPropagation) e.stopPropagation();
      var open = menu.hidden;
      // One thing open at a time. A list inside the button of the row closes the
      // control that is open, and a control that opens closes the list.
      if (open && inRow(wrap)) show("");
      if (open) closeList();
      menu.hidden = !open;
      openList = open ? menu : null;
      syncElementMenu();
    });
    wrap.appendChild(trigger);
    wrap.appendChild(menu);
    return wrap;
  }

  /**
   * A shadow, written out as the shorthand.
   *
   * CSS has no box-shadow-offset-x. The longhands that look like one
   * (box-shadow-blur and box-shadow-color) exist only inside an @property
   * registration, and the offsets and spread have none at all — the browser
   * drops an unknown property on the floor, so writing five invented ones draws
   * no shadow at all. One shorthand is the honest way.
   *
   * [x, y, blur, spread, colour], with x/y/blur/spread absent meaning 0 — the
   * same defaults getComputedStyle hands back for a "none" shadow.
   *
   * The words of the selection are shadowed with text-shadow, and a box with
   * box-shadow: a shadow on a paragraph is the letters' own, not the block's.
   * A text shadow has no spread, so the fourth length is left out there.
   */
  function shadow(values) {
    var text = selectedKind === "text";
    // Nothing to cast: the lengths are zero and a colour draws nothing, so the
    // property is emptied instead and the element is left as the page had it.
    var flat = !values[0] && !values[1] && !values[2] && (text || !values[3]);
    var parts = [values[0] + "px", values[1] + "px", values[2] + "px"];
    if (!text && values[3]) parts.push(values[3] + "px");
    // A shadow with no colour of its own is the words' colour: css says so, and
    // "undefined" in the shorthand would say nothing at all.
    if (values[4]) parts.push(values[4]);
    set(text ? "text-shadow" : "box-shadow", flat ? "" : parts.join(" "));
  }

  /**
   * The computed shadow of the selection, as the four lengths and the colour.
   * A shadow is one shorthand, so it is read as one: the colour is the rgba()
   * it names, and the lengths are the px it spells.
   */
  function shadowParts() {
    var value = String(get(selectedKind === "text" ? "text-shadow" : "box-shadow") || "").trim();
    var colour = (value.match(/rgba?\([^)]*\)/) || [""])[0];
    var lengths = (value.replace(/rgba?\([^)]*\)/, "").match(/-?[\d.]+px/g) || []).map(parseFloat);
    return [lengths[0] || 0, lengths[1] || 0, lengths[2] || 0, lengths[3] || 0, colour];
  }

  /* ---------------------------------------------------------------- colour */

  // The colours a picker offers are the page's own: nothing is saved here to
  // offer back, because a list of our colours says nothing about this site.

  /** The three channels of a #rrggbb string. */
  function rgbOf(value) {
    return value.slice(1).match(/../g).map(function (part) { return parseInt(part, 16); });
  }

  /**
   * A colour a person or the browser wrote, as channels and an alpha.
   *
   * The two families that can hold an alpha are the two understood: #rgb,
   * #rrggbb, #rrggbbaa, and rgb() or rgba() with commas or spaces. Anything else
   * — a name, an hsl(), an oklch() — is refused rather than guessed at, so the
   * field that calls this can say it does not know instead of writing a colour
   * nobody asked for. The computed style of any element is rgb() or rgba(), so
   * this reads what the browser itself resolved.
   */
  function readColour(value) {
    var text = String(value == null ? "" : value).trim().toLowerCase();
    var hex = text.match(/^#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/);
    if (hex) {
      var digits = hex[1];
      if (digits.length === 3) digits = digits.replace(/./g, function (c) { return c + c; });
      return {
        channels: rgbOf("#" + digits.slice(0, 6)),
        alpha: digits.length === 8 ? parseInt(digits.slice(6), 16) / 255 : 1,
      };
    }
    var parts = text.match(/^rgba?\(([^)]+)\)$/);
    if (!parts) return null;
    var list = parts[1].split(/[,\s/]+/).filter(Boolean).slice(0, 4).map(Number);
    var channels = list.slice(0, 3);
    if (channels.length < 3 || channels.some(function (n) { return !(n >= 0 && n <= 255); })) return null;
    var alpha = list.length > 3 ? list[3] : 1;
    if (!(alpha >= 0 && alpha <= 1)) return null;
    return { channels: channels.map(Math.round), alpha: alpha };
  }

  /**
   * Channels as hue in degrees, saturation and brightness in percent.
   *
   * The three numbers the picker's controls are: hue is a slider, and the field
   * reads saturation across and brightness up. HSB rather than HSL, because that
   * is the pair the field draws — white to the hue across, clear to black up —
   * and no HSL value paints that shape.
   */
  function toHsb(channels) {
    var r = channels[0] / 255;
    var g = channels[1] / 255;
    var b = channels[2] / 255;
    var max = Math.max(r, g, b);
    var span = max - Math.min(r, g, b);
    var h = 0;
    if (span) {
      if (max === r) h = ((g - b) / span) % 6;
      else if (max === g) h = (b - r) / span + 2;
      else h = (r - g) / span + 4;
      h = (h * 60 + 360) % 360;
    }
    return { h: h, s: max ? (span / max) * 100 : 0, b: max * 100 };
  }

  /** Back to channels, from the same three numbers. */
  function fromHsb(hsb) {
    var c = (hsb.b / 100) * (hsb.s / 100);
    var x = c * (1 - Math.abs(((hsb.h / 60) % 2) - 1));
    var m = hsb.b / 100 - c;
    var at = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(hsb.h / 60) % 6];
    return at.map(function (v) { return Math.round((v + m) * 255); });
  }

  /**
   * The colour picker, in the shape HeroUI's controlled picker draws: the field
   * with the dot on it, the hue slider with the browser's own picker beside it,
   * and one line holding the hex code and the transparency as a percentage.
   *
   * The address is rgba. A colour with any transparency is written as
   * rgba(r, g, b, a), the only way css can say "see through", and a solid one as
   * #rrggbb, which is what the project's own code wants to read. Either way the
   * property goes through set(), so undo, the edits list and Save all see the
   * same change.
   *
   * `current` is the colour the property holds now — a name, an rgb(), an
   * rgba(), or nothing — and `put(value)` is how that property is written: the
   * text colour sets `color` and repaints the bar in the dock, a box colour sets
   * `background-color`, a shadow rebuilds the whole shorthand.
   *
   * The field and the slider are drawn rather than taken from the browser: a
   * native range cannot carry a 20px track with capped ends. Each one holds a
   * real range input behind the drawing, so Tab reaches it and the arrow keys
   * move it, and the dot wears the focus ring while it has the keyboard.
   */
  function picker(current, put) {
    var panel = document.createElement("div");
    panel.className = "color-panel";
    // A colour that cannot be read — a name, an oklch(), nothing at all — opens
    // the picker on the ink the dock is drawn in. Opening on black would claim
    // the page is a colour it never wrote.
    var read = readColour(current);
    var channels = read ? read.channels : [134, 84, 107];
    var hsb = toHsb(channels);
    // A colour at zero alpha is one nobody can see, and there is nothing to pick
    // from: the picker opens solid, so the first colour it writes shows.
    var alpha = read && read.alpha ? read.alpha : 1;
    var typing = false;

    function hexOf() {
      return "#" + channels.map(function (channel) { return ("0" + channel.toString(16)).slice(-2); }).join("");
    }
    /** The colour as the element's css takes it. */
    function css() {
      if (alpha >= 1) return hexOf();
      return "rgba(" + channels.join(", ") + ", " + Math.round(alpha * 1000) / 1000 + ")";
    }
    /** A colour painted over the checkerboard, so a see-through one reads as
        one rather than as a pale solid. Paper and ink alpha, like the track's. */
    function overCheckers(value) {
      return "linear-gradient(" + value + ", " + value + ")," +
        " repeating-conic-gradient(#ffffff 0% 25%, #25241f14 0% 50%) 50% / 16px 16px";
    }

    /** Draw the picker from the colour it holds, and write that colour out. */
    function write() {
      paint();
      put(css());
    }

    /** The field's own two numbers are the colour: read them back as channels. */
    function fromField() {
      channels = fromHsb(hsb);
      write();
    }

    /** One change that is one keystroke or one pick: one step in the undo stack. */
    function once(fn) {
      hold();
      fn();
      release();
    }

    /**
     * Drag a control. The gesture keeps the pointer until it ends, so the hand
     * may leave the control — and the panel — without the colour stopping, and
     * the whole drag is one step in the undo stack.
     */
    function drag(el, place) {
      var down = false;
      el.addEventListener("pointerdown", function (e) {
        if (e.preventDefault) e.preventDefault();
        if (el.setPointerCapture && e.pointerId !== undefined) el.setPointerCapture(e.pointerId);
        down = true;
        el.setAttribute("data-dragging", "true");
        hold();
        place(e);
      });
      el.addEventListener("pointermove", function (e) { if (down) place(e); });
      function stop() {
        el.removeAttribute("data-dragging");
        if (!down) return;
        down = false;
        release();
      }
      el.addEventListener("pointerup", stop);
      el.addEventListener("pointercancel", stop);
    }

    /** Where a pointer is on a control, as fractions from its top-left corner. */
    function spot(el, e) {
      var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
      if (!rect || !rect.width || !rect.height) return null;
      var clamp = function (n) { return Math.max(0, Math.min(1, n)); };
      return { x: clamp((e.clientX - rect.left) / rect.width), y: clamp((e.clientY - rect.top) / rect.height) };
    }

    /**
     * The real input behind a drawn control. Invisible and holding no pointer,
     * but Tab reaches it and the arrow keys move it, so the drawn slider has a
     * keyboard and a screen reader as well as a dot to drag.
     */
    function range(max, label, onMove) {
      var input = document.createElement("input");
      input.type = "range";
      input.className = "knob";
      input.min = 0;
      input.max = max;
      input.step = 1;
      input.setAttribute("aria-label", label);
      input.addEventListener("input", function () {
        once(function () { onMove(Number(input.value)); });
      });
      return input;
    }

    /**
     * One drawn slider: a 20px track with a cap at each end, the dot that rides
     * it, and the input behind both. `set` takes a value and puts it in the
     * colour; paint() puts the colour's value back into the input.
     */
    function rail(cls, label, max, set) {
      var wrap = document.createElement("div");
      wrap.className = "slider " + cls;
      var line = document.createElement("div");
      line.className = "track";
      var thumb = document.createElement("span");
      thumb.className = "track-thumb";
      line.appendChild(thumb);
      var input = range(max, label, set);
      wrap.appendChild(line);
      wrap.appendChild(input);
      drag(line, function (e) {
        var at = spot(line, e);
        if (at) set(Math.round(at.x * max));
      });
      input.addEventListener("focus", function () { wrap.setAttribute("data-focus-visible", "true"); });
      input.addEventListener("blur", function () { wrap.removeAttribute("data-focus-visible"); });
      return { wrap: wrap, line: line, thumb: thumb, input: input };
    }

    // The field, with the dot on it: saturation across, brightness up.
    var field = document.createElement("div");
    field.className = "field";
    field.setAttribute("aria-label", "Colour area");
    var dot = document.createElement("span");
    dot.className = "field-thumb";
    field.appendChild(dot);
    var saturation = range(100, "Saturation", function (value) { hsb.s = value; fromField(); });
    var brightness = range(100, "Brightness", function (value) { hsb.b = value; fromField(); });
    [saturation, brightness].forEach(function (input) {
      // The ring a keyboard needs, drawn on the dot the pointer uses.
      input.addEventListener("focus", function () { field.setAttribute("data-focus-visible", "true"); });
      input.addEventListener("blur", function () { field.removeAttribute("data-focus-visible"); });
      field.appendChild(input);
    });
    drag(field, function (e) {
      var at = spot(field, e);
      if (!at) return;
      hsb.s = at.x * 100;
      hsb.b = (1 - at.y) * 100;
      fromField();
    });
    panel.appendChild(field);

    // The hue, with the browser's own picker beside it: the one control that
    // reaches a colour no picker on this panel can draw.
    var hue = rail("hue-slider", "Hue", 360, function (value) {
      hsb.h = value;
      fromField();
    });
    var row = document.createElement("div");
    row.className = "pick-row";
    row.appendChild(hue.wrap);
    var native = document.createElement("input");
    native.type = "color";
    native.className = "colour-picker";
    native.setAttribute("aria-label", "Pick a colour");
    native.addEventListener("input", function () {
      once(function () {
        channels = rgbOf(native.value);
        hsb = toHsb(channels);
        alpha = 1;
        write();
      });
    });
    var open = document.createElement("button");
    open.type = "button";
    open.className = "icon-button";
    open.title = "Pick a colour";
    open.setAttribute("aria-label", "Pick a colour");
    open.innerHTML = svg("pipette");
    open.addEventListener("click", function () { if (native.click) native.click(); });
    row.appendChild(open);
    row.appendChild(native);
    panel.appendChild(row);

    // The value, in the field a form would use: the colour as a swatch, the
    // words beside it, and the transparency as the percentage it is.
    var valueField = document.createElement("label");
    valueField.className = "value-field";
    var chip = document.createElement("span");
    chip.className = "chip";
    valueField.appendChild(chip);
    var typed = document.createElement("input");
    typed.type = "text";
    typed.setAttribute("aria-label", "Colour value");
    typed.addEventListener("focus", function () { typing = true; });
    typed.addEventListener("blur", function () { typing = false; });
    typed.addEventListener("change", function () {
      var read = readColour(typed.value);
      // A value that cannot be read is put back, rather than guessed at.
      if (!read) {
        typed.value = hexOf();
        return;
      }
      once(function () {
        channels = read.channels;
        hsb = toHsb(channels);
        alpha = read.alpha;
        write();
      });
    });
    valueField.appendChild(typed);
    var opacity = document.createElement("span");
    opacity.className = "alpha";
    var percent = document.createElement("input");
    percent.type = "number";
    percent.min = 0;
    percent.max = 100;
    percent.step = 1;
    percent.setAttribute("aria-label", "Alpha");
    scrub(percent);
    percent.addEventListener("input", function () {
      if (percent.value === "") return;
      var value = Math.max(0, Math.min(100, Number(percent.value)));
      once(function () {
        alpha = value / 100;
        write();
      });
    });
    opacity.appendChild(percent);
    opacity.appendChild(text("%"));
    valueField.appendChild(opacity);
    panel.appendChild(valueField);
    pop.appendChild(panel);

    /** Draw every control from the colour the picker holds. */
    function paint() {
      var pure = "hsl(" + Math.round(hsb.h) + ",100%,50%)";
      // The field's own layers, in the order the picker paints them: black into
      // clear up the box, white into the hue across it, the hue itself under
      // both. Saturation is x and brightness is y, which is that pair.
      field.style.background =
        "linear-gradient(to top, black, transparent)," +
        " linear-gradient(to right, hsl(" + Math.round(hsb.h) + ",0%,100%), transparent)," +
        " " + pure;
      dot.style.left = hsb.s + "%";
      dot.style.top = 100 - hsb.b + "%";
      dot.style.backgroundColor = css();
      saturation.value = Math.round(hsb.s);
      brightness.value = Math.round(hsb.b);
      hue.thumb.style.left = (hsb.h / 360) * 100 + "%";
      hue.thumb.style.backgroundColor = pure;
      hue.input.value = Math.round(hsb.h);
      percent.value = Math.round(alpha * 100);
      chip.style.background = overCheckers(css());
      // The field holds the hex code and the percentage holds the transparency,
      // so the words stay short enough to read in a narrow panel. Left alone
      // while it is being typed into: a half-written colour is not a value, and
      // writing over it would take the caret away.
      if (!typing) typed.value = hexOf();
    }

    paint();
  }


  /** Everything the payload writes goes through here, so nothing is ever lost. */
  function set(prop, value) {
    if (!selected) return;
    apply(prop, value);
    refit();
    tally();
  }

  // A direction, align or gap without a box is nothing: flex, unless the
  // element already is a box — read fresh each time, so an earlier pick in
  // the same control still counts.
  function ensureBox() {
    var current = mode();
    if (current === "absolute") {
      setMode("flex");
      return;
    }
    var display = String(get("display") || "").trim();
    if (display !== "flex" && display !== "grid") {
      set("position", "");
      set("display", current === "stack" ? "flex" : current);
      if (current === "stack") set("flex-direction", "column");
    }
  }

  function mode() {
    var rec = selected && record(selected);
    if (rec && rec.layoutMode) return rec.layoutMode;
    if (String(get("position") || "").trim() === "absolute") return "absolute";
    var display = String(get("display") || "").trim();
    if (display === "flex" || display === "inline-flex") return "flex";
    if (display === "grid" || display === "inline-grid") return "grid";
    return "stack";
  }

  function setMode(value) {
    var rec = record(selected);
    var previous = mode();
    rec.layoutMode = value;
    if (value === "absolute") {
      set("display", "block");
      set("position", "absolute");
    } else if (value === "stack") {
      set("position", "");
      set("display", "flex");
      set("flex-direction", "column");
    } else {
      set("position", "");
      set("display", value);
      if (value === "flex" && previous === "stack") set("flex-direction", "row");
    }
  }

  /* -------------------------------------------------------------- reflow */

  /** Every child of `el` that has a box, with the box it has now. */
  function boxes(el) {
    var out = [];
    var kids = (el && el.children) || [];
    for (var i = 0; i < kids.length; i++) {
      var box = kids[i].getBoundingClientRect();
      // A child with no box — display:none, or a comment-like wrapper — has no
      // place to move from and no place to move to.
      if (!box || (!box.width && !box.height)) continue;
      out.push({ kid: kids[i], box: box });
    }
    return out;
  }

  /**
   * Run a change that moves the children of a container, and play the move.
   *
   * flex-direction, flex-wrap, alignment and display are not animatable, so the
   * browser teleports the children to their new places. This measures where they
   * were, makes the change, measures again, and animates the difference: the
   * children glide from the old place to the new one instead of jumping. The
   * selection frame is part of what the user watches change, so it moves too.
   *
   * The move rides the individual `translate` property, so a child that already
   * wears a transform keeps it.
   *
   * shortcut: a child that sets `translate` itself loses it for the length of the
   * move; upgrade by folding the computed value into the first keyframe.
   */
  function reflow(el, change) {
    if (!el || !moves(el)) return change();
    // A second click interrupts the first move. The runs are dropped first, so
    // the boxes measured below are the layout's own and not a half-played move.
    slideRuns.forEach(function (run) { run.cancel(); });
    slideRuns = [];
    unwrapWords();
    // The caret owns the words it is in: they are boxed only when nobody is
    // typing in them, and then only the frame moves.
    if (el !== editing) wrapWords(el);
    var was = boxes(el);
    var frame = frameNow();
    var out = change();
    moveFrame(frame);
    var runs = slide(was, boxes(el));
    if (wordBoxes.length) {
      if (!runs.length) unwrapWords();
      // Only the move's own end puts the words back. A cancel is not hooked up:
      // a cancelled run delivers its cancel after the NEXT move has boxed its
      // own words, and would take those out of the page instead of its own —
      // every move after the first played on nodes that were no longer in it.
      // The boxes of a move that was cut short are taken out at the top of
      // reflow, which is where the cut happens.
      else runs[runs.length - 1].onfinish = unwrapWords;
    }
    return out;
  }

  // The children moves that are still playing.
  var slideRuns = [];

  // The words that are in a box for the length of a move.
  var wordBoxes = [];
  // Past this many words, a paragraph is left to the layout: four hundred boxes
  // to watch is not a move worth making. The frame still changes with it.
  var WORD_LIMIT = 400;

  function wordCount(el) {
    var total = 0;
    for (var i = 0; i < el.childNodes.length; i++) {
      var node = el.childNodes[i];
      if (node.nodeType !== 3) continue;
      String(node.nodeValue || "")
        .split(/\s+/)
        .forEach(function (word) { if (word) total++; });
    }
    return total;
  }

  /**
   * Put the element's own words in boxes, so each one can be moved on its own.
   *
   * A line box is not an element: it can be neither measured as one nor animated
   * as one. A word can, and every word on a line moves by that line's own amount,
   * so a word that glides takes its line with it. The spaces stay outside the
   * boxes, so a line breaks and a text justifies where it did.
   */
  function wrapWords(el) {
    var count = wordCount(el);
    if (!count || count > WORD_LIMIT) return;
    var nodes = [];
    for (var i = 0; i < el.childNodes.length; i++) {
      if (el.childNodes[i].nodeType === 3) nodes.push(el.childNodes[i]);
    }
    nodes.forEach(function (node) {
      var parent = node.parentElement;
      if (!parent) return;
      String(node.nodeValue || "").split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (!/\S/.test(part)) {
          parent.insertBefore(document.createTextNode(part), node);
          return;
        }
        // Only an inline-block can carry a transform; a word is one word wide, so
        // it is the smallest box that moves with the line it is on.
        var box = document.createElement("span");
        box.style.display = "inline-block";
        box.setAttribute("data-edityy-word", "");
        box.appendChild(document.createTextNode(part));
        parent.insertBefore(box, node);
        wordBoxes.push(box);
      });
      parent.removeChild(node);
    });
  }

  /** Take the words back out of their boxes, exactly as they were. */
  function unwrapWords() {
    wordBoxes.forEach(function (box) {
      var parent = box.parentElement;
      if (!parent) return;
      if (box.firstChild) parent.insertBefore(box.firstChild, box);
      parent.removeChild(box);
    });
    wordBoxes = [];
  }

  function slide(was, now) {
    var runs = [];
    now.forEach(function (item) {
      var before = was.filter(function (old) { return old.kid === item.kid; })[0];
      if (!before) return;
      var dx = before.box.left - item.box.left;
      var dy = before.box.top - item.box.top;
      if (!dx && !dy) return; // it did not move
      var run = item.kid.animate([{ translate: dx + "px " + dy + "px" }, { translate: "0px 0px" }], {
        duration: T.rise,
        easing: ARRIVE,
      });
      slideRuns.push(run);
      runs.push(run);
    });
    return runs;
  }

  /* The selection frame's box, as the inline values place() writes it with. */
  var FRAME_BOX = ["left", "top", "width", "height"];
  // The eased move of the selection frame, and the box it is heading for.
  var frameRun = null;
  var frameTo = null;

  function frameNow() {
    if (!selBox || selBox.hidden || !selBox.style.left) return null;
    var out = {};
    FRAME_BOX.forEach(function (prop) { out[prop] = selBox.style[prop]; });
    return out;
  }

  /**
   * Play the selection frame from the box it wore to the box it wears now.
   *
   * place() writes the box straight onto the frame, because the frame follows the
   * pointer and an eased frame is a frame the pointer has already left. A frame
   * that is already drawn and only changes size is not following anything: the
   * box shrinking or growing is part of the change the user made, so it moves.
   */
  function moveFrame(was) {
    var now = frameNow();
    if (!was || !now || !moves(selBox)) return;
    if (FRAME_BOX.every(function (prop) { return was[prop] === now[prop]; })) return;
    if (frameRun) frameRun.cancel();
    frameTo = now;
    frameRun = selBox.animate([was, now], { duration: T.rise, easing: ARRIVE });
  }

  /**
   * A frame put where a pointer is going, not a box the user is watching.
   *
   * The box the frame has just been put in is compared with the box the eased
   * move is heading for: the same box is that move drawing itself, and it plays
   * on. A box from somewhere else is the pointer's, and the move is dropped.
   */
  function dropFrame(box) {
    if (!frameRun) return;
    if (FRAME_BOX.every(function (prop) { return frameTo[prop] === box[prop]; })) return;
    frameRun.cancel();
    frameRun = null;
    frameTo = null;
  }

  function alignValue(value, fallback) {
    var v = String(value || "").trim();
    if (v === "start") v = "flex-start";
    if (v === "end") v = "flex-end";
    return v === "flex-start" || v === "center" || v === "flex-end" ? v : fallback;
  }

  /**
   * Four sides of padding or margin, as one field per pair of sides. Left and
   * right take the same value, and so do top and bottom: a box is even both ways
   * far more often than not, so a tied pair is one field, not two. The link
   * beside a pair breaks it, and each side then takes a value of its own.
   * Written as the longhands, so the edits list says which side changed and an
   * undo puts back exactly the sides that moved.
   */
  function sides(prop, min, max) {
    var PAIRS = [
      { sides: ["top", "bottom"], labels: ["Top", "Bottom"], glyphs: ["arrow-up", "arrow-down"], both: "move-vertical" },
      { sides: ["left", "right"], labels: ["Left", "Right"], glyphs: ["arrow-left", "arrow-right"], both: "move-horizontal" },
    ];
    var values = {};
    ["top", "right", "bottom", "left"].forEach(function (side) {
      values[side] = num(prop + "-" + side, 0);
    });
    /** One field: the sides it writes, its glyph, and its name for a reader. */
    function field(row, group, glyph, name) {
      var cell = document.createElement("label");
      if (group.length > 1) cell.className = "wide";
      cell.innerHTML = svg(glyph);
      var input = document.createElement("input");
      input.type = "number";
      input.min = min;
      input.max = max;
      input.step = 1;
      input.value = values[group[0]];
      input.setAttribute("aria-label", name + " " + prop);
      input.addEventListener("input", function () {
        if (input.value === "") return; // blank while typing is not a value
        hold();
        group.forEach(function (side) { set(prop + "-" + side, Number(input.value) + "px"); });
      });
      input.addEventListener("change", release);
      cell.appendChild(input);
      scrub(input);
      row.appendChild(cell);
      return { cell: cell, input: input };
    }
    var panel = document.createElement("div");
    panel.className = "sides";
    PAIRS.forEach(function (pair) {
      // A pair the stylesheet already sets apart opens as a broken pair.
      var tied = values[pair.sides[0]] === values[pair.sides[1]];
      var row = document.createElement("div");
      row.className = "sides-pair";
      panel.appendChild(row);
      var both = field(row, pair.sides, pair.both, pair.labels[0] + " and " + pair.labels[1].toLowerCase());
      var left = field(row, [pair.sides[0]], pair.glyphs[0], pair.labels[0]);
      var right = field(row, [pair.sides[1]], pair.glyphs[1], pair.labels[1]);
      var link = document.createElement("button");
      link.type = "button";
      link.className = "icon-button side-link";
      link.title = both.input.getAttribute("aria-label") + " together";
      link.setAttribute("aria-label", link.title);
      row.appendChild(link);
      function show() {
        both.cell.hidden = !tied;
        left.cell.hidden = tied;
        right.cell.hidden = tied;
        link.setAttribute("aria-pressed", tied ? "true" : "false");
        link.innerHTML = svg(tied ? "link" : "unlink");
      }
      show();
      // A tied pair is one field, so what is typed into it moves both sides, and
      // the two fields it stands for already say the same thing when it breaks.
      both.input.addEventListener("input", function () {
        left.input.value = both.input.value;
        right.input.value = both.input.value;
      });
      link.addEventListener("click", function () {
        tied = !tied;
        if (tied) {
          // Back together: the first side is the value both of them take.
          var value = left.input.value || "0";
          var moved = String(right.input.value) !== value;
          right.input.value = value;
          both.input.value = value;
          if (moved) set(prop + "-" + pair.sides[1], value + "px");
          release();
        }
        show();
      });
    });
    pop.appendChild(panel);
  }

  function spacingControl() {
    // Both rows are the shared number field, which appends to the panel itself,
    // so there is no wrapper here: a <div> whose class matched no rule dressed
    // nothing at all. A glyph stands where the words would: sideways for the
    // letters, up and down for the lines.
    number(-4, 16, 0.1, num("letter-spacing", 0), function (v) {
      set("letter-spacing", v + "px");
    }, { glyph: "move-horizontal", label: "Letter spacing" });
    number(0.8, 3, 0.05, num("line-height", 1.3), function (v) {
      set("line-height", v);
    }, { glyph: "move-vertical", label: "Line spacing" });
  }

  /**
   * Where the border sits, read from the line it is drawn with: a border is drawn
   * inside the box, an outline outside it, and an outline pulled in by half its
   * width straddles the edge — the middle.
   */
  function borderEdge() {
    if (!(num("outline-width", 0) > 0)) return "inside";
    return (parseFloat(get("outline-offset")) || 0) < 0 ? "center" : "outside";
  }

  /** How wide the line is, wherever it sits. */
  function borderWidth() {
    // The computed width first, and the shorthand a value we wrote ourselves may
    // be the only record of: outline-width says nothing until the browser has
    // resolved the shorthand.
    var outline = num("outline-width", 0) || parseFloat(get("outline")) || 0;
    return Math.round(outline > 0 ? outline : num("border-width", 0));
  }

  /** The colour the line is drawn in, wherever it sits. */
  function borderColour() {
    return borderEdge() === "inside" ? get("border-color") : get("outline-color");
  }

  /**
   * Draw the border where it was asked for: one line, one width, one colour.
   *
   * CSS draws a border inside the box and an outline outside it. So the middle is
   * the outside line pulled in by half its own width, and the three are one line
   * in three places rather than three different things to style.
   */
  function setBorder(edge, width, colour) {
    var outside = edge !== "inside";
    set("border-width", outside ? "" : width + "px");
    set("border-style", outside || !width ? "" : "solid");
    // A border takes its room from the box it sits in; an outline takes none, and
    // an inside line that grows the element was never inside it.
    set("box-sizing", !outside && width ? "border-box" : "");
    set("outline", outside && width ? width + "px solid " + (colour || "currentColor") : "");
    set("outline-offset", outside && width && edge === "center" ? -(width / 2) + "px" : "");
    if (colour) set(outside ? "outline-color" : "border-color", colour);
  }

  /** The three places a border can sit, in the order of the list. */
  var BORDER_EDGES = [
    { value: "inside", label: "Inside" },
    { value: "center", label: "Center" },
    { value: "outside", label: "Outside" },
  ];

  var CONTROLS = {
    radius: function () {
      number(0, 200, 1, Math.round(parseFloat(get("border-radius")) || 0), function (v) {
        set("border-radius", v + "px");
      }, { glyph: "corner-radius", label: "Radius" });
    },
    opacity: function () {
      // The dock's one number field, as every other value in it: the percentage
      // is the number, and the property is that number over a hundred.
      number(0, 100, 1, Math.round((parseFloat(get("opacity")) || 1) * 100), function (v) {
        set("opacity", v / 100);
      }, { glyph: "droplet", label: "Opacity" });
    },
    mode: function () {
      // The row turns over into the new mode's own controls, and the children of
      // the box take their own new places under it.
      reflow(selected, remode);
    },
    family: function () {
      familyControl();
    },
    weight: function () {
      var info = weightInfo();
      if (info.kind === "variable") {
        number(info.min, info.max, 1, Math.max(info.min, Math.min(info.max, num("font-weight", info.min))), function (v) {
          set("font-weight", v);
        }, { glyph: "bold", label: "Font weight" });
      } else if (info.kind === "fixed") {
        var current = num("font-weight", info.values[0]);
        // One field, drawn like the size control in the dock: the number and a
        // bare chevron inside it, so the list is not a second box beside the value.
        var row = document.createElement("div");
        row.className = "value-field weight-control";
        var input = document.createElement("input");
        input.type = "number";
        input.min = info.values[0];
        input.max = info.values[info.values.length - 1];
        input.step = 1;
        input.value = current;
        input.setAttribute("aria-label", "Custom font weight");
        input.addEventListener("input", function () {
          if (input.value === "") return;
          hold();
          set("font-weight", input.value);
        });
        input.addEventListener("change", release);
        row.appendChild(input);
        scrub(input);
        row.appendChild(customSelect(info.values.map(function (value) {
          var labels = { 300: "Light", 400: "Regular", 500: "Medium", 600: "Semibold", 700: "Bold", 800: "Extra bold", 900: "Black" };
          return { value: value, label: labels[value] ? labels[value] + " (" + value + ")" : String(value) };
        }), current, function (v) {
          input.value = v;
          set("font-weight", v);
        }, "Font weight choices", true));
        pop.appendChild(row);
      }
    },
    spacing: spacingControl,
    align: cycleAlignment,
    decorate: function () {
      icons(DECORATIONS, decorations(), function (v) {
        return decorate(v);
      });
    },
    color: function () {
      picker(get("color"), function (value) {
        set("color", value);
        paintSwatch();
      });
    },
    fill: function () {
      picker(get("background-color"), function (value) {
        set("background-color", value);
      });
    },
    border: function () {
      var edge = borderEdge();
      var width = borderWidth();
      var colour = borderColour();
      picker(colour, function (value) {
        colour = value;
        setBorder(edge, width, colour);
      });
      // A colour on a border that has no width is a colour nobody sees, so the
      // width is offered too. A hairline, in the ramp: thick enough to read,
      // thin enough not to shout. Where the line sits is the second half of the
      // same line: it decides which line the width is written to, so the panel is
      // drawn again when it changes.
      var row = document.createElement("div");
      row.className = "field-line";
      number(0, 120, 1, width, function (v) {
        width = v;
        setBorder(edge, width, colour);
      }, { glyph: "square", label: "Border width" }, row);
      row.appendChild(customSelect(BORDER_EDGES, edge, function (value) {
        setBorder(value, width, colour);
        show("border");
      }, "Border position", false));
      pop.appendChild(row);
    },
    shadow: function () {
      var text = selectedKind === "text";
      var values = shadowParts();
      // Two fields to a line: the offsets, then the lengths of the edge. A glyph
      // stands where "Blur" and "Spread" would, so four fields fit two lines and
      // the colour keeps a line of its own.
      var fields = [
        { i: 0, label: "X", min: -40, max: 40 },
        { i: 1, label: "Y", min: -40, max: 40 },
        { i: 2, label: { glyph: "blur", label: "Blur" }, min: 0, max: 80 },
      ];
      // A text shadow has no spread: the letters cast it, not the box.
      if (!text) fields.push({ i: 3, label: { glyph: "maximize", label: "Spread" }, min: -40, max: 40 });
      var grid = document.createElement("div");
      grid.className = "shadow-grid";
      pop.appendChild(grid);
      fields.forEach(function (field) {
        number(field.min, field.max, 1, values[field.i], function (v) {
          values[field.i] = v;
          shadow(values);
        }, field.label, grid);
      });
      picker(values[4], function (value) {
        values[4] = value;
        shadow(values);
      });
    },
    // Direction as a cycle button: one click moves to the next value, so no
    // control opens. Flex-only in the table, but a grid is left alone — the
    // property is harmless there and yanking the mode surprises.
    direction: function () {
      // Establish the flex box first so the user's row or column choice sticks.
      if (!pop.hidden) show("");
      var current = String(get("flex-direction") || "row").trim();
      var at = DIRECTIONS.map(function (item) { return item.v; }).indexOf(current);
      reflow(selected, function () {
        ensureBox();
        set("flex-direction", DIRECTIONS[(at + 1) % DIRECTIONS.length].v);
      });
      paintCycle(DIRECTIONS, "direction", "flex-direction");
    },
    // The same 3x3 interaction maps to the right CSS axes for each layout.
    alignment: function () {
      var direction = mode() === "stack"
        ? "column"
        : String(get("flex-direction") || "row").trim();
      var main = alignValue(get("justify-content"), "flex-start");
      var cross = alignValue(get("align-items"), "flex-start");
      var current = direction === "column" ? cross + ":" + main : main + ":" + cross;
      icons(ALIGN_CELLS, current, function (v) {
        var parts = v.split(":");
        reflow(selected, function () {
          if (direction === "column") {
            set("align-items", parts[0]);
            set("justify-content", parts[1]);
          } else {
            set("justify-content", parts[0]);
            set("align-items", parts[1]);
          }
          ensureBox();
        });
        return [v];
      }, "grid3");
    },
    // Wrap as a cycle button, like direction. Keep this control usable for
    // existing `inline-flex` elements too. The mode is normalized to flex, then
    // the value is written after the box is established; setting it in the
    // opposite order can be lost on mode change.
    wrap: function () {
      if (!pop.hidden) show("");
      var current = String(get("flex-wrap") || "nowrap").trim();
      var at = WRAPS.map(function (item) { return item.v; }).indexOf(current);
      reflow(selected, function () {
        setMode("flex");
        set("flex-wrap", WRAPS[(at + 1) % WRAPS.length].v);
      });
      paintCycle(WRAPS, "wrap", "flex-wrap");
    },
    gap: function () {
      if (mode() === "grid") {
        var pair = document.createElement("div");
        pair.className = "pair";
        pop.appendChild(pair);
        number(0, 160, 1, num("column-gap", 0), function (v) {
          set("column-gap", v + "px");
        }, { glyph: "columns-2", label: "Column gap" }, pair);
        number(0, 160, 1, num("row-gap", 0), function (v) {
          set("row-gap", v + "px");
        }, { glyph: "rows-2", label: "Row gap" }, pair);
        return;
      }
      number(0, 160, 1, num("gap", 0), function (v) {
        set("gap", v + "px");
        ensureBox();
      }, { glyph: "unfold-horizontal", label: "Gap" });
    },
    padding: function () { sides("padding", 0, 160); },
    margin: function () { sides("margin", -160, 160); },
  };

  /** What an element currently has, from the cascade or from a change we made. */
  function get(prop) {
    if (!selected) return "";
    var view = window.getComputedStyle(selected);
    return view ? view.getPropertyValue(prop) : "";
  }

  /** The same, for any element rather than the selection. */
  function viewOf(node) {
    var view = window.getComputedStyle(node);
    return {
      getPropertyValue: function (prop) {
        return view ? view.getPropertyValue(prop) : "";
      },
    };
  }

  /**
   * A colour the chrome paints itself with, read from its own custom properties
   * so the frame wears the palette the page handed the chrome (the --edityy-*
   * hooks). Unset, or a page that hands over nothing, gives the DESIGN.md value.
   */
  function chromeColour(prop, fallback) {
    return String(viewOf(host).getPropertyValue(prop)).trim() || fallback;
  }

  /** The same, as a number, with a sensible default when it cannot be read. */
  function num(prop, fallback) {
    var v = parseFloat(get(prop));
    return isNaN(v) ? fallback : v;
  }

  /**
 * Toggle one decoration among the others.
 *
 * text-decoration-line is a space-separated list, so underline and strikethrough
 * are both legitimate on the same words. Picking one adds it, picking it again
 * takes it off, and the list is only emptied when nothing is left.
 *
 * Italic sits in the same row but is not a decoration: it is font-style, and
 * `text-decoration-line: italic` is invalid, so the browser drops it.
 */
function decorate(el) {
  if (el === "italic") {
    if (get("font-style") === "italic") {
      set("font-style", "");
      // Still italic from the stylesheet (an <em>, say): override it.
      if (get("font-style") === "italic") set("font-style", "normal");
    } else {
      set("font-style", "italic");
    }
    return decorations();
  }
  var current = decorations().filter(function (v) { return v !== "italic"; });
  var at = current.indexOf(el);
  if (at === -1) current.push(el);
  else current.splice(at, 1);
  set("text-decoration-line", current.join(" "));
  return decorations();
}

/** The decorations that are on now, with italic read from font-style. */
function decorations() {
  var on = String(get("text-decoration-line") || "none")
    .split(/\s+/)
    .filter(function (v) { return v && v !== "none"; });
  if (get("font-style") === "italic") on.push("italic");
  return on;
}

/** The dock itself: seven icons, a `+`, and only one control open at a time. */
  /** Is this control on show for the selected element? The row itself is the
      only list that matters now that it is rebuilt per element. */
  function icon(key) {
    return slot(key);
  }

  /** The dock's button for a key: icons in the row, plus the `+` at the end. */
  function slot(key) {
    if (key === "changes") return review;
    for (var i = 0; i < row.children.length; i++) {
      if (row.children[i].dataset.key === key) return row.children[i];
      if (key === "edits" && row.children[i] === review) return row.children[i];
    }
    return null;
  }

  /** Open this control, or close it if it is the one already open. */
  function toggle(key) {
    var target = slot(key);
    if (!target || target.disabled) return;
    var open = pop.children[0] && target.getAttribute("aria-expanded") === "true";
    show(open ? "" : key);
  }

  /**
   * A media element's dock is its own three controls, worn in the row: the two
   * lengths, and the corner on them. Its opacity is added with the `+`, as a
   * shadow or a border is.
   */
  // The toolbar has three parts: Comment, Add, Edits. Comment is on entry.
  // One tool at a time. A second click on the active tool drops to browse.
  var activeTool = "comment";

  /** Press a tool in the row. A second press drops to browse. */
  function pressTool(key) {
    // Edits is one of the tools now, not a button beside them: pressing it
    // makes it the one on, so Comment and Add drop off as they do for each
    // other. A second press closes the list and leaves no tool on.
    if (activeTool === key) {
      activeTool = "";
      show("");
      if (key !== "edits") select(null);
      syncRow();
      syncElementMenu();
      syncPointer();
      return;
    }
    activeTool = key;
    show(key === "edits" ? "changes" : "");
    // Add is freeform: it starts with nothing selected and no card open, so a
    // drag can never begin on an element or move one.
    if (key === "add") {
      regionFor = null;
      openComment = null;
      drawing = null;
      regionBox.hidden = true;
      select(null);
      hideMenu();
    }
    syncRow();
    syncElementMenu();
    syncPointer();
  }

  /** Paint which tool is on. Browse presses none. */
  function syncRow() {
    for (var i = 0; i < row.children.length; i++) {
      var b = row.children[i];
      if (b === review) {
        // If the list closed some other way, Edits is no longer the tool on:
        // it cannot stay pressed with nothing open.
        if (activeTool === "edits" && openKey !== "changes") activeTool = "";
        var editsOn = activeTool === "edits";
        b.setAttribute("aria-pressed", editsOn ? "true" : "false");
        paintTool(b, "edits", editsOn);
        continue;
      }
      var on = b.dataset.key === activeTool && !!activeTool;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      paintTool(b, b.dataset.key, on);
    }
  }

  /** Swap a toolbar button between its outline and its filled twin. Only the
      three tools have twins, and only while a trial family is on: with Lucide
      there is no filled twin, so the markup stays as buildRow painted it. */
  function paintTool(b, key, pressed) {
    if (!TOOL_FAMILIES.tabler[key]) return;
    var want = pressed ? "filled" : "outline";
    if (b.dataset.twin === want) return;
    b.dataset.twin = want;
    var badge = b === review && countBadge.parentNode === b ? countBadge : null;
    if (badge) b.removeChild(badge);
    b.innerHTML = toolSvg(key, "", pressed);
    if (badge) b.appendChild(badge);
  }



  /** The controls on show: the seven (text only), plus whatever was added to this element. */
  function buildRow() {
    var focused = within(row, root.activeElement) ? controlOf(root.activeElement) : null;
    var focusKey = focused ? focused.dataset.key : null;
    while (row.firstChild) row.removeChild(row.firstChild);
    delete row.dataset.glide;
    var tools = [
      { key: "comment", label: "Comment (C)", glyph: "message-square" },
      { key: "add", label: "Add (A)", glyph: "square-plus" },
      { key: "edits", label: "Edits (E)", glyph: "square-text" }
    ];
    tools.forEach(function (tool) {
      // Edits is the saved list, kept on the review button so its count badge
      // stays. It wears an icon like the three tools, not words.
      if (tool.key === "edits") {
        review.innerHTML = "";
        review.className = "ic";
        review.id = "review";
        review.innerHTML = toolSvg(tool.key, tool.glyph, false);
        review.appendChild(countBadge);
        review.dataset.key = "edits";
        review.setAttribute("aria-label", "Edits (E)");
        row.appendChild(review);
        return;
      }
      row.appendChild(button("ic", toolSvg(tool.key, tool.glyph, false), tool.label, function () { pressTool(tool.key); }, tool.key));
    });
    for (var t = 0; t < row.children.length; t++) row.children[t].title = "";
    syncRow();
    var first = row.children[0];
    rove(first);
    if (focusKey !== null) {
      var back = slot(focusKey) || first;
      if (back) {
        rove(back);
        if (back.focus) back.focus();
      }
    }
  }

  /**
   * The row is one toolbar and one tab stop: Tab reaches it once, and the arrows
   * move along it. The icon that has the stop is the one Tab comes back to.
   */
  function rove(target) {
    for (var i = 0; i < row.children.length; i++) {
      row.children[i].setAttribute("tabindex", row.children[i] === target ? "0" : "-1");
    }
  }

  /** The control in the row that has the tab stop. */
  function rowStop() {
    for (var i = 0; i < row.children.length; i++) {
      if (row.children[i].getAttribute("tabindex") === "0") return row.children[i];
    }
    return null;
  }

  /** The first control a keyboard can reach inside `node`, in document order. */
  function firstStop(node) {
    for (var i = 0; i < (node.children || []).length; i++) {
      var child = node.children[i];
      if (child.hidden) continue;
      var tabindex = child.getAttribute ? child.getAttribute("tabindex") : null;
      var focusable = /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(child.tagName) || (tabindex !== null && tabindex !== undefined);
      if (focusable && tabindex !== "-1" && !child.disabled) return child;
      var inner = firstStop(child);
      if (inner) return inner;
    }
    return null;
  }

  function within(parent, node) {
    for (; node; node = node.parentElement) if (node === parent) return true;
    return false;
  }

  // A row control's panel is drawn above the row, and it comes before the row
  // in the tab order, so Tab from the control would skip it. Tab from the
  // control steps into the open panel. Tab off the panel's end comes back to
  // the control, and the Tab after that moves on, so focus is never held.
  var backFromPanel = false;
  row.addEventListener("focusin", function (e) {
    backFromPanel = within(pop, e.relatedTarget);
  });
  dock.addEventListener("keydown", function (e) {
    if (e.key !== "Tab" || e.shiftKey || pop.hidden || !openKey || openKey === "changes" || backFromPanel) return;
    if (e.target !== slot(openKey)) return;
    var first = firstStop(pop);
    if (!first || !first.focus) return;
    if (e.preventDefault) e.preventDefault();
    first.focus();
  });

  row.addEventListener("keydown", function (e) {
    var keys = { ArrowRight: 1, ArrowLeft: -1, Home: "first", End: "last" };
    if (!(e.key in keys)) return;
    var items = Array.prototype.slice.call(row.children);
    var at = items.indexOf(e.target);
    if (at === -1) return;
    var move = keys[e.key];
    var next = move === "first" ? 0 : move === "last" ? items.length - 1 : (at + move + items.length) % items.length;
    rove(items[next]);
    if (items[next].focus) items[next].focus();
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
  });

  /** The primary-dock control a pointer or the keyboard is on, if any. */
  function controlOf(node) {
    while (node && node !== row) {
      if (node.dataset && node.dataset.key) return node;
      node = node.parentElement;
    }
    return null;
  }

  // The tooltips of the row are one group, after interior.dev. The first one
  // waits, so a pointer that only crosses the dock on its way to the page does
  // not light it up. Once one has shown, the group is warm: the next one opens
  // at once and slides over from the last, until the group has been quiet for a
  // moment. A closing tooltip waits too, so the 2px gap between two icons does
  // not close it and open it again.
  var TIP_OPEN = 200;
  var TIP_CLOSE = 120;
  var TIP_WARM = 400;
  var TIP_REST = "translate(-50%,-100%)";
  // Below the control instead, for one that stands near the top of the screen.
  var TIP_BELOW = "translate(-50%,0)";
  var tipFor = null; // the control the tooltip is over, while it is on show
  var tipAt = null; // the control the pointer or the focus is on
  var tipBlocked = null; // a control whose panel just opened: no tooltip over it
  var tipWarm = false;
  var tipX = null; // where the last tooltip stood, so the next knows its way
  var tipOpening = 0;
  var tipClosing = 0;
  var tipCooling = 0;
  // The animations running on the tip and on its words, so a new one can stop
  // the old one. Two animations on the same property are not one animation:
  // the older one keeps its own effect until it ends.
  var tipRun = null;
  var labelRun = null;

  /** Stop whatever the tip is doing now. */
  function stopTipRun() {
    if (tipRun) {
      tipRun.cancel();
      tipRun = null;
    }
    if (labelRun) {
      labelRun.cancel();
      labelRun = null;
    }
  }
  var tipLeaving = null;

  /** Ask for the tooltip over a control; `now` skips the wait, for the keyboard. */
  function showTip(button, now) {
    tipAt = button;
    if (button === tipBlocked) return;
    // A control that already says what it is needs no tip: the words on the
    // button are the tip, and a second one under the pointer is noise.
    if (saysItself(button)) {
      hideTip(true);
      return;
    }
    clearTimeout(tipClosing);
    clearTimeout(tipCooling);
    if (button === tipFor) return;
    clearTimeout(tipOpening);
    if (now === true || tipWarm) return drawTip(button);
    tipOpening = setTimeout(function () { drawTip(button); }, TIP_OPEN);
  }

  /**
   * Does this control already say what it is?
   *
   * The words on a button are the tip: a Save button that says Save does not
   * need one, and a field that holds a number says the number already. The
   * labels the dock hides are not words the reader can see, so they do not
   * count: `innerText` leaves out what is not shown.
   */
  function saysItself(node) {
    if (!node) return false;
    // A chip wears a mark where its words would be — W, H, T, R, B, L, or the ×
    // between two counts — and a mark says which field this is, not what it is.
    // So a chip keeps its tip, whether the field is empty or holds a value.
    if (String(node.className || "").split(" ").indexOf("dock-count") !== -1) return false;
    // A count chip in the comment card is the same: its number is its value,
    // not its name, so it keeps its tip too.
    if (String(node.className || "").split(" ").indexOf("element-comment-chip") !== -1) return false;
    var words = node.innerText;
    if (words === undefined || words === null) words = node.textContent || "";
    if (String(words).trim()) return true;
    // A field that holds a value says it too: the number in the box is the
    // number a tip would say.
    var field = node.querySelector && node.querySelector("input");
    return !!(field && String(field.value || "").trim());
  }

  /** Draw the tooltip over a control, in the words of its own label. */
  function drawTip(button) {
    var words = button.getAttribute && button.getAttribute("aria-label");
    if (!words || !button.getBoundingClientRect) return;
    var box = button.getBoundingClientRect();
    var x = box.left + box.width / 2;
    // Above the control, unless it stands at the top of the screen: a tip that
    // runs off the edge says nothing. The element menu floats at the element, so
    // its actions can be up there.
    var above = box.top > 46;
    var rest = above ? TIP_REST : TIP_BELOW;
    var shown = !!tipFor && !tipLeaving;
    var warm = tipWarm;
    var from = tipX;
    var travel = from === null ? 0 : x > from ? 1 : x < from ? -1 : 0;
    // Where the tip is now, before anything is stopped. The travel starts
    // from here, so a tip that is still rising does not jump to full size the
    // moment it starts to travel.
    var now = tipNow();
    if (tipLeaving) {
      tipLeaving.cancel();
      tipLeaving = null;
    }
    // Whatever was still running on the tip is stopped: a rise that is still
    // going would keep its blur and its size over the travel that replaces it.
    stopTipRun();
    tipFor = button;
    tipWarm = true;
    tipX = x;
    tip.dataset.side = above ? "top" : "bottom";
    // A tip over the comment card wears the card's size: 90% of every part.
    tip.dataset.size = button.closest && button.closest(".element-comment") ? "small" : "full";
    tip.hidden = false;
    tip.style.left = x + "px";
    tip.style.top = (above ? box.top - 8 : box.bottom + 8) + "px";
    tip.style.transform = rest;
    var label = document.createElement("span");
    label.textContent = words;
    tip.textContent = "";
    tip.appendChild(label);
    // The close chip sits on the dock's top-right corner, where a tip for
    // the last control draws over it. Lift the tip clear of the chip, so
    // the chip stays visible while its neighbour names itself.
    var chip = $("dock-close");
    if (above && chip && chip.getBoundingClientRect) {
      var cr = chip.getBoundingClientRect();
      var tr = tip.getBoundingClientRect();
      if (cr.width && tr.left < cr.right && tr.right > cr.left && tr.top < cr.bottom && tr.bottom > cr.top) {
        tip.style.top = (parseFloat(tip.style.top) - (tr.bottom - cr.top + 4)) + "px";
      }
    }
    if (!moves(tip)) return;
    var slide = [{ opacity: 0, transform: "translateX(" + travel * 14 + "px)" }, { opacity: 1, transform: "none" }];
    if (shown && from !== null) {
      // On show already: the box travels from the last control to this one,
      // and the new words come in from the side it travelled from.
      //
      // It travels from where it is, not from where it was: a tip that is
      // still rising when the pointer crosses the row must not jump to full
      // size the moment it starts to travel.
      tipRun = animate(
        tip,
        [
          { opacity: now.opacity, transform: travelFrom(from, x, now.transform) },
          { opacity: 1, transform: rest },
        ],
        { duration: T.rise, easing: ARRIVE }
      );
      labelRun = animate(label, slide, { duration: T.settle, easing: ARRIVE });
    } else if (warm) {
      // Closed a moment ago: no second rise, only a quick fade in place.
      tipRun = animateFrom(tip, [{ opacity: 1 }], { duration: T.fade, easing: STANDARD });
      labelRun = animate(label, slide, { duration: T.settle, easing: ARRIVE });
    } else {
      // The first of the group rises out of the control, a little blurred.
      tipRun = animate(
        tip,
        [
          { opacity: 0, transform: rest + " translateY(" + (above ? 7 : -7) + "px) scale(.9)", filter: "blur(4px)" },
          { opacity: 1, transform: rest, filter: "blur(0px)" },
        ],
        { duration: T.rise, easing: ARRIVE }
      );
      labelRun = animate(label, [{ opacity: 0, transform: "translateY(9px)" }, { opacity: 1, transform: "none" }], { duration: T.enter, easing: ARRIVE });
    }
  }

  /**
   * Let the tooltip go. With `now` it goes at once and the group cools: a panel
   * opened under it, and the control that opened it gets no tooltip until the
   * pointer has left it.
   */
  function hideTip(now) {
    clearTimeout(tipOpening);
    if (now === true) {
      tipBlocked = tipAt;
      clearTimeout(tipClosing);
      clearTimeout(tipCooling);
      tipWarm = false;
      tipX = null;
      if (tipLeaving) tipLeaving.cancel();
      tipLeaving = null;
      stopTipRun();
      tipFor = null;
      tip.hidden = true;
      return;
    }
    if (!tipFor) return;
    clearTimeout(tipClosing);
    tipClosing = setTimeout(closeTip, TIP_CLOSE);
  }

  function closeTip() {
    tipFor = null;
    clearTimeout(tipCooling);
    tipCooling = setTimeout(function () {
      tipWarm = false;
      tipX = null;
    }, TIP_WARM);
    if (!moves(tip)) {
      tip.hidden = true;
      return;
    }
    // The tip leaves from wherever it is: a tip that is still rising when the
    // pointer goes does not jump to full size on its way out.
    stopTipRun();
    var rest = tip.dataset.side === "bottom" ? TIP_BELOW : TIP_REST;
    // The tip leaves from wherever it is: a tip that is still rising when the
    // pointer goes does not jump to full size on its way out.
    var out = animateFrom(
      tip,
      [{ opacity: 0, transform: rest + " translateY(2.5px) scale(.96)", filter: "blur(2px)" }],
      { duration: T.fade, easing: LEAVE, fill: "forwards" }
    );
    tipLeaving = out;
    out.onfinish = function () {
      if (tipLeaving !== out) return;
      tipLeaving = null;
      tip.hidden = true;
      out.cancel();
    };
  }

  /** Is `node` inside the row? The gaps between icons are the row too. */
  function inRow(node) {
    while (node) {
      if (node === row) return true;
      node = node.parentElement;
    }
    return false;
  }

  /**
   * Is `node` the list part of a control: its chevron, or the options under it?
   * The list says what it is, so it opens no tooltip of its own.
   */
  function inList(node) {
    while (node && node !== row) {
      if (String(node.className || "").indexOf("custom-select") !== -1) return true;
      node = node.parentElement;
    }
    return false;
  }

  /** Move the row's one hover fill under a control. */
  function glideTo(button) {
    row.style.setProperty("--glide-x", (button.offsetLeft || 0) + "px");
    row.style.setProperty("--glide-y", (button.offsetTop || 0) + "px");
    row.style.setProperty("--glide-w", (button.offsetWidth || 32) + "px");
    row.style.setProperty("--glide-h", (button.offsetHeight || 32) + "px");
    if (row.dataset.glide !== undefined) return;
    // It fades in where it lands, and only travels from the next control on.
    row.dataset.glide = "";
    var warm = function () {
      if (row.dataset.glide === "") row.dataset.glide = "warm";
    };
    nextFrame(warm);
    // A frame that never comes would leave the fill cold for the rest of the
    // session, and it would never travel again.
    setTimeout(warm, 60);
  }

  function glideOff() {
    delete row.dataset.glide;
  }

  // The row's own slide, while it is moving to its new place.
  var rowRun = null;

  /**
   * The row grew, and the dock is centred, so every control in it moved. The
   * row slides to its new place instead of jumping: the move is a transform,
   * not a change of width, so nothing in the row is measured again.
   *
   * `delta` is how far the row's left edge moved. The row starts where it was
   * and travels to where it is now.
   */
  function slideRow(delta) {
    if (!delta || !moves(row)) return;
    if (rowRun) {
      rowRun.cancel();
      rowRun = null;
    }
    rowRun = animate(
      row,
      [{ transform: "translateX(" + delta + "px)" }, { transform: "translateX(0px)" }],
      { duration: T.settle, easing: ARRIVE, fill: "forwards" }
    );
    if (!rowRun) return;
    rowRun.onfinish = function () {
      rowRun = null;
      row.style.transform = "";
      // The panel over the dock is placed against the control it belongs to,
      // and the control has just moved: it is placed again.
      if (openKey) placePop(openKey);
    };
  }

  // The row the mode change left, kept in place while the new row takes over.
  // The pointer's fill and the tip belong to the row's last layout, so they stay
  // down until the pointer comes back to it, or they would point at nothing.
  var hoverParked = false;
  // The run that owns the row's own styles. A change that interrupts one takes
  // them over, so the run it interrupted cannot give them back mid-flight.
  var rowBox = null;

  /**
   * The row as it was, as a still picture: the same controls in a box of the
   * same size, in the same place, out of the tab order and out of the reach of
   * the pointer. The mode change rebuilds the row, and this is what the eye is
   * still on while the new row takes over.
   */
  function stillRow(before) {
    var box = document.createElement("div");
    box.className = "row still";
    box.setAttribute("aria-hidden", "true");
    // Inert as well: one of its controls still holds the row's tab stop, and a
    // Tab during the motion must not land on a control that is leaving.
    box.inert = true;
    box.style.cssText =
      "position:fixed;pointer-events:none;left:" + before.left + "px;top:" + before.top +
      "px;width:" + before.width + "px;height:" + before.height + "px";
    while (row.firstChild) box.appendChild(row.firstChild);
    host.appendChild(box);
    return box;
  }

  /** Cycle the layout mode, and let the row turn over instead of cutting. */
  function remode() {
    var at = MODES.indexOf(mode());
    // The mode control is about to be replaced, and it may be where the keyboard
    // is: the new one takes the stop back.
    var held = within(row, root.activeElement);
    var before = row.getBoundingClientRect();
    var still = moves(row) ? stillRow(before) : null;
    setMode(MODES[(at + 1) % MODES.length]);
    buildRow();
    show("");
    // The fill under the pointer was measured on the pair of controls it sat
    // between, and that pair is gone: it goes down with them.
    tipAt = null;
    hideTip(true);
    glideOff();
    hoverParked = true;
    if (held) {
      var back = slot("mode");
      if (back) {
        rove(back);
        if (back.focus) back.focus();
      }
    }
    if (still) glideRow(still, before);
  }

  /**
   * A layout mode change, as a motion. The row is a different set of controls in
   * each mode and the dock is centred, so the change moves the row's left edge
   * and changes its width in one frame.
   *
   * A control both modes have is the same control, and it travels to where the
   * new row puts it. What the mode changes cross over, and the box takes its new
   * width under them.
   */
  function glideRow(still, before) {
    var after = row.getBoundingClientRect();
    var controls = Array.prototype.slice.call(row.children);
    // The box changes width under its own controls, so it is a window on them
    // while it does: nothing wraps onto a second line, and nothing spills out.
    row.style.flexWrap = "nowrap";
    row.style.overflow = "hidden";
    // Started before the controls are measured: the box is already at the width
    // it starts from, so a control that travels starts where it is drawn.
    var run = animate(
      row,
      [{ width: before.width + "px" }, { width: after.width + "px" }],
      { duration: T.settle, easing: ARRIVE }
    );
    rowBox = run;
    var olds = Array.prototype.slice.call(still.children);
    controls.forEach(function (item) {
      var twin = null;
      for (var i = 0; i < olds.length && !twin; i++) {
        if (olds[i].dataset.key === item.dataset.key) twin = olds[i];
      }
      var to = item.getBoundingClientRect();
      var from = twin ? twin.getBoundingClientRect() : null;
      // Two controls are one control only if they are the same box: a chip that
      // became a count is a different control in the same place.
      if (from && Math.abs(from.width - to.width) < 2) {
        twin.style.visibility = "hidden";
        animate(
          item,
          [
            { transform: "translate(" + (from.left - to.left) + "px," + (from.top - to.top) + "px)" },
            { transform: "none" },
          ],
          { duration: T.settle, easing: ARRIVE }
        );
        return;
      }
      // A control the mode adds arrives where it belongs, once the ones that
      // travel are on their way.
      animate(
        item,
        [{ opacity: 0, transform: "scale(.9)" }, { opacity: 1, transform: "none" }],
        { duration: T.enter, easing: ARRIVE, delay: T.fade }
      );
    });
    var gone = animate(still, [{ opacity: 1 }, { opacity: 0 }], {
      duration: T.fade,
      easing: LEAVE,
      delay: T.fade,
      fill: "forwards",
    });
    if (gone) gone.onfinish = function () { still.remove(); };
    else still.remove();
    var takeBack = function () {
      if (rowBox !== run) return;
      rowBox = null;
      row.style.flexWrap = "";
      row.style.overflow = "";
    };
    if (run) run.onfinish = takeBack;
    else takeBack();
  }

  // The row is rebuilt as the selection moves, so the hint is delegated: one
  // listener covers every control that will ever be in the row.
  row.addEventListener("pointerover", function (e) {
    // The row the pointer is over was replaced under it by a mode change, and
    // the control it is on now is not the one it was measured on. The fill and
    // the tip wait for the pointer to move.
    if (hoverParked) return;
    // A tap is a press, not a hover: a touch fill would stick where the tap
    // landed, and the press scale already answers it.
    if (e.pointerType === "touch") return;
    var button = controlOf(e.target);
    if (!button) return;
    // The list that comes out of a chip belongs to that chip: an option is not a
    // control of the row, so it neither moves the row's fill nor names itself.
    if (inList(e.target)) {
      tipAt = null;
      hideTip(true);
      return;
    }
    glideTo(button);
    showTip(button);
  });
  row.addEventListener("pointerout", function (e) {
    var to = controlOf(e.relatedTarget);
    if (to !== tipBlocked) tipBlocked = null;
    if (!to) {
      tipAt = null;
      hideTip();
    }
    if (!inRow(e.relatedTarget)) {
      // The pointer has left the row it was parked on, so the next one it comes
      // to is a control it saw arrive.
      hoverParked = false;
      glideOff();
    }
  });
  // The park ends with a move of the pointer: a row that changed under a still
  // pointer has no control where the pointer is until the pointer says so.
  row.addEventListener("pointermove", function (e) {
    if (!hoverParked) return;
    if (e.pointerType === "touch") return;
    var button = controlOf(e.target);
    if (!button || inList(e.target)) return;
    hoverParked = false;
    glideTo(button);
    showTip(button);
  });
  row.addEventListener("focusin", function (e) {
    var button = controlOf(e.target);
    if (button && !inList(e.target)) {
      // The keyboard gets the same fill the pointer does: a tip alone leaves
      // the stop on the row invisible.
      glideTo(button);
      showTip(button, true);
    }
  });
  row.addEventListener("focusout", function (e) {
    tipAt = null;
    tipBlocked = null;
    hideTip();
    // Focus moving along the row keeps its fill and travels with it; only
    // focus leaving the row takes the fill away.
    if (!inRow(e.relatedTarget)) glideOff();
  });

  /** The element-menu action under a pointer or the keyboard, if any. */
  /**
   * The control of the menu under a pointer or the keyboard, if any: an
   * action, and a count chip in the comment card. The canvas row is left
   * out — its words are its own name.
   */
  function tipOf(node) {
    while (node && node !== elementMenu) {
      var cls = String(node.className || "").split(" ");
      if (cls.indexOf("element-action") !== -1) return node;
      if (cls.indexOf("element-comment-chip") !== -1) return node;
      node = node.parentElement;
    }
    return null;
  }

  // The menu is rebuilt under the element it belongs to, so its hints are
  // delegated too: an action is its icon alone, and the words are the drawn tip.
  elementMenu.addEventListener("pointerover", function (e) {
    var action = tipOf(e.target);
    if (action) showTip(action);
  });
  elementMenu.addEventListener("pointerout", function (e) {
    if (tipOf(e.relatedTarget)) return;
    tipAt = null;
    hideTip();
  });
  elementMenu.addEventListener("focusin", function (e) {
    var action = tipOf(e.target);
    if (action) showTip(action, true);
  });
  elementMenu.addEventListener("focusout", function () {
    tipAt = null;
    hideTip();
  });

  /** The row starts empty: buildRow() fills it for whichever element is selected. */
  buildRow();

  /**
   * The `+` at the end of the row: pick a control and it joins this element's
   * row, where it looks like it was always there.
   *
   * Appended last, and a control picked from it goes in before it, so adding one
   * grows the row leftwards from the button that added it — the icons already
   * there do not move under the pointer that just clicked.
   */
  function addOne() {
    // The list of what can be added, with the ones this element already has
    // gone: an icon that is there cannot be added twice.
    options(
      addable().filter(function (item) { return !icon(item.key); })
          .map(function (item) { return { v: item.key, label: item.label }; }),
      "",
      function (key) {
        var item = addable().filter(function (a) { return a.key === key; })[0];
        if (!item || !selected || icon(key)) return;
        // Recorded on the element, so this control belongs to this element and
        // comes back only for it.
        var rec = record(selected);
        rec.added = (rec.added || []).concat(key);
        // The row is about to grow, and the dock is centred, so every control
        // in it moves. Where the row was is remembered, so the row can slide
        // to its new place instead of jumping.
        var before = row.getBoundingClientRect().left;
        buildRow();
        var after = row.getBoundingClientRect().left;
        // The control that was just picked arrives, so the row's edge is not
        // the only thing that moves.
        var control = icon(key);
        if (control) control.className = control.className + " arriving";
        toggle(key); // straight into the control that was just picked
        slideRow(before - after);
      }
    );
  }

  /** Show the dock for a text or container selection, and keep its control open
      across a re-click on the same element, which is the click that starts a drag. */
  function syncDock() {
    if (editing) return;
    var dockWasHidden = dock.hidden;
    // The toolbar is one surface. It is up whenever the mode is on, with or
    // without a selection, and with one element or several.
    if (!active) {
      show("");
      // The way back out is the way in, backwards: the controls wave out,
      // the bar and dock fade, and the pill with the logo grows back.
      staggerOut(function () { hideDock(restoreLogo); });
      return;
    }
    // An exit fade still in flight is put away: re-entering before it lands
    // must cancel the landing, or it hides the dock under the live mode.
    if (dock.hidden || dockLeaving) showDock();
    else dock.style.pointerEvents = "";
    row.hidden = false;
    if (dockWasHidden && !dock.hidden) {
      extendBar();
      // Only an entry waves the controls in: a dock that reappears mid-mode
      // simply draws out, as it always did.
      if (entering) staggerIn();
    }
    syncRow();
  }

  /**
   * Put the dock away: it fades where it stands, the way it came. The pill
   * already waits where the bar stood, and takes over when the fade lands.
   *
   * A dock that leaves in one frame is a dock that was snatched away, and the
   * reader was not done with it.
   */
  function hideDock(done) {
    if (dock.hidden) { if (done) done(); return; }
    if (dockLeaving) return;
    if (!moves(dock)) {
      dock.hidden = true;
      if (done) done();
      return;
    }
    var out = animate(
      dock,
      [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(12px) scale(.96)" }],
      { duration: T.fade, easing: LEAVE, fill: "forwards" }
    );
    if (!out) {
      dock.hidden = true;
      if (done) done();
      return;
    }
    // A dock that is on its way out takes no clicks: it is leaving.
    dock.style.pointerEvents = "none";
    dockLeaving = out;
    out.onfinish = function () {
      dockLeaving = null;
      dock.hidden = true;
      out.cancel();
      if (done) done();
    };
  }

  /** Bring the dock back: a fade that was leaving is put away. */
  function showDock() {
    // The fade out that took the dock away left it with no clicks. A dock that
    // comes back gives them back, whether that fade was interrupted or had
    // already finished — otherwise the row is there and every click in it lands
    // on the page behind.
    dock.style.pointerEvents = "";
    if (dockLeaving) {
      // The dock is on its way out and is wanted back: it comes back from
      // where it is, not from where it was. A dock that snapped back to full
      // would be a dock that was snatched away and put back in one frame.
      animateFrom(
        dock,
        [{ opacity: 1, transform: "none" }],
        { duration: T.enter, easing: ARRIVE }
      );
      dockLeaving.cancel();
      dockLeaving = null;
      dock.hidden = false;
      return;
    }
    if (!dock.hidden) return;
    dock.hidden = false;
    // Comes back from the corner, the way it went.
    animate(
      dock,
      [{ opacity: 0, transform: "translateX(12px)" }, { opacity: 1, transform: "none" }],
      { duration: T.enter, easing: ARRIVE }
    );
  }

  /* --------------------------------------------------------- element menu */

  // The menu is its own card at the element, never a row of the dock: the dock
  // sits at the bottom of the page and the menu follows the element.

  /* --------------------------------------------------------------- review */

  // Properties Edityy writes for its own sake, never as an edit: the focus ring
  // it hides on the words being typed into.
  var OWN = { outline: true };
  var SOURCE_ATTR = "data-edityy-src";

  /**
   * What one record really changed, or null.
   *
   * Compared with what was there before, not with whether a control was touched:
   * a slider dragged out and back is no edit, and listing it would send a coding
   * agent after a change that is not there.
   */
  function diff(rec) {
    var props = [];
    Object.keys(rec.props).forEach(function (key) {
      if (OWN[key]) return;
      var rule = ruleOf(key);
      // A rule has no value before it: the page's own rule for this element is
      // not read, so the edit is the rule and nothing else.
      var before = rule ? "" : rec.set[key] ? rec.props[key] : "";
      var after = readProp(rec, key);
      if (after === before) return;
      var entry = { prop: rule ? rule.property : key, before: rec.was[key] || before, after: after };
      if (rule && rule.on) entry.on = rule.on;
      if (rule && rule.when) entry.when = rule.when;
      // Only while the family is still the Google font that was picked: an undo
      // or a later pick puts a different family there.
      if (!rule && key === "font-family" && rec.googleFont && faceName(after).toLowerCase() === rec.googleFont.toLowerCase()) {
        entry.googleFont = rec.googleFont;
      }
      props.push(entry);
    });
    var text = rec.text !== null && rec.el.textContent !== rec.text
      ? { before: rec.text, after: rec.el.textContent }
      : null;
    // An element added and then deleted in this session leaves nothing to report.
    if (rec.created && rec.removed) return null;
    // Not moved while it is still in the air, nor once it is deleted: "Removed"
    // already says where it went.
    var moved = rec.location && rec.el !== moving && !rec.removed &&
      (rec.el.parentElement !== rec.location.parent || rec.el.nextSibling !== rec.location.before);
    return props.length || text || rec.comment || rec.created || rec.removed || moved
      ? { props: props, text: text, comment: rec.comment || null, created: rec.created, added: rec.created ? creation(rec) : null, removed: !!rec.removed, moved: !!moved, movedTo: moved ? selectorFor(rec.el.parentElement) : null }
      : null;
  }

  /**
   * What an agent needs to make an added element: its tag, the style it was
   * made with (a later change to that style is listed as a property), and the
   * elements it was put around.
   */
  function creation(rec) {
    return {
      tag: rec.el.tagName.toLowerCase(),
      style: rec.createdStyle || "",
      wraps: (rec.wrapped || []).map(function (item) { return item.selector; }),
    };
  }

  /**
   * A CSS selector that finds this element again: its id, a test id, or the
   * tag path down from the nearest one, with :nth-of-type only where a tag has
   * siblings of the same name. Short on purpose — it is read by a person or an
   * agent searching the code, not only by querySelector.
   */
  function selectorFor(el) {
    var esc = window.CSS && window.CSS.escape
      ? window.CSS.escape
      : function (v) { return String(v).replace(/[^\w-]/g, "\\$&"); };
    var parts = [];
    var node = el;
    while (node && node.tagName && node !== document.body && node !== document.documentElement && parts.length < 8) {
      if (node.id) {
        parts.unshift("#" + esc(node.id));
        break;
      }
      var tag = node.tagName.toLowerCase();
      var testId = node.getAttribute && node.getAttribute("data-testid");
      if (testId) {
        parts.unshift(tag + '[data-testid="' + String(testId).replace(/"/g, '\\"') + '"]');
        break;
      }
      var parent = node.parentElement;
      if (parent && parent.children) {
        var same = 0;
        var index = 0;
        for (var i = 0; i < parent.children.length; i++) {
          if (parent.children[i].tagName !== node.tagName) continue;
          same++;
          if (parent.children[i] === node) index = same;
        }
        if (same > 1) tag += ":nth-of-type(" + index + ")";
      }
      parts.unshift(tag);
      node = parent;
    }
    return parts.join(" > ");
  }

  /**
   * Where the element was written, when the Vite plugin stamped it: its own
   * location, or the nearest ancestor's when it was made by a component.
   */
  function sourceOf(el) {
    for (var node = el; node && node.getAttribute; node = node.parentElement) {
      var at = node.getAttribute(SOURCE_ATTR);
      if (at) return { at: at, own: node === el };
    }
    return null;
  }

  /** Every edit, as plain data: what a person, an agent or a file can use. */
  function report() {
    var out = [];
    changes.forEach(function (rec) {
      var d = diff(rec);
      if (!d) return;
      if (rec.mark == null) rec.mark = markTop++;
      var src = sourceOf(rec.el);
      out.push({
        mark: rec.mark,
        label: nameOf(rec.el).trim(),
        selector: rec.selector || selectorFor(rec.el),
        source: rec.source ? rec.source.at : src ? src.at : null,
        sourceIsOwn: rec.source ? rec.source.own : src ? src.own : false,
        props: d.props,
        text: d.text,
        comment: d.comment,
        created: d.created,
        added: d.added,
        removed: d.removed,
        moved: d.moved,
        movedTo: d.movedTo,
        rec: rec,
      });
    });
    // Drawn boxes travel with the edits: each one is a change of its own.
    regions.forEach(function (rg) {
      if (rg.mark == null) rg.mark = markTop++;
      out.push({
        mark: rg.mark,
        label: "Added region",
        selector: "",
        source: null,
        sourceIsOwn: false,
        props: [],
        text: null,
        comment: rg.comment || null,
        created: false,
        added: null,
        removed: false,
        moved: false,
        movedTo: null,
        region: { left: rg.left, top: rg.top, width: rg.width, height: rg.height },
        rec: null,
      });
    });
    return out;
  }

  /** What an agent must do for a Google font, which the project does not load yet. */
  function googleFontNote(family) {
    return "`" + family + "` is a Google font that the project does not load. " +
      "Add it to the project the way the project loads its fonts, then use it in `font-family`.";
  }

  /** The same, as Markdown written for a coding agent to act on. */
  function markdown(items) {
    if (!items.length) return "";
    var page = window.location && window.location.href;
    var out = [
      "# Visual edits from Edityy",
      "",
      "Apply these edits to the source code" + (page ? " of " + page : "") + ". " +
        "Change the code that renders each element, in the styling approach the project already uses " +
        "(CSS, CSS modules, Tailwind classes, styled components), not with inline styles.",
      "",
    ];
    items.forEach(function (item, i) {
      out.push("## " + (i + 1) + ". " + item.label);
      out.push("");
      if (item.selector) out.push("- Selector: `" + item.selector + "`");
      if (item.region) {
        var r = item.region;
        out.push("- Region: a `" + r.width + " × " + r.height + "` pixel box at `" + r.left + "px from the left, " + r.top + "px from the top` of the page. Put the new element inside it.");
      }
      if (item.source) {
        out.push("- Source: `" + item.source + "`" + (item.sourceIsOwn ? "" : " (the nearest element with a known location)"));
      }
      item.props.forEach(function (c) {
        out.push("- `" + c.prop + "`" + (c.on ? " on `" + c.on + "`" : "") + (c.when ? " in `@media " + c.when + "`" : "") +
          ": `" + (c.before || "unset") + "` → `" + (c.after || "unset") + "`");
        if (c.googleFont) out.push("- Font: " + googleFontNote(c.googleFont));
      });
      if (item.added) {
        out.push("- Added: a new `" + item.added.tag + "`" + (item.added.style ? " with `" + item.added.style + "`" : ""));
        if (item.added.wraps.length) {
          out.push("- Wraps: " + item.added.wraps.map(function (selector) { return "`" + selector + "`"; }).join(", "));
        }
      }
      if (item.removed) out.push("- Removed: " + item.label);
      if (item.moved) out.push("- Moved to: `" + (item.movedTo || "a new position") + "`");
      if (item.text) out.push("- Text: " + JSON.stringify(item.text.before) + " → " + JSON.stringify(item.text.after));
      if (item.comment) out.push("- Comment: " + JSON.stringify(item.comment));
      out.push("");
    });
    return out.join("\n");
  }

  /** Keep the number on the edits button in step with the edits. */
  function tally() {
    keepSoon();
    var items = report();
    var n = items.length;
    paintMarks(items);
    var was = countBadge.hidden ? 0 : Number(countBadge.textContent) || 0;
    countBadge.hidden = !n;
    countBadge.textContent = n ? String(n) : "";
    // The number answers the edit that changed it: it pops in when it first
    // appears, and gives a small beat when it changes after that.
    if (n && n !== was && moves(countBadge)) {
      animate(
        countBadge,
        was
          ? [{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }]
          : [{ opacity: 0, transform: "scale(.5)" }, { opacity: 1, transform: "scale(1)" }],
        { duration: was ? T.rise : T.enter, easing: ARRIVE }
      );
    }
    // An open list shows the edits, so redraw it when they change. Do not redraw
    // it while the user types: a redraw on each key resets the scroll position of
    // the list.
    if (review.getAttribute("aria-expanded") === "true" && !editing) show("changes");
  }

  /** Numbered marks on changed elements and saved boxes. One circle each,
   * drawn where the edit is, shown at once and kept through a reload. */
  function paintMarks(items) {
    items = items || report();
    while (marksBox.firstChild) marksBox.removeChild(marksBox.firstChild);
    if (!active || !items.length) {
      marksBox.hidden = true;
      return;
    }
    var x = window.pageXOffset || window.scrollX || 0;
    var y = window.pageYOffset || window.scrollY || 0;
    items.forEach(function (item) {
      if (item.mark == null) return;
      var at = null;
      if (item.rec && item.rec.el && item.rec.el.getBoundingClientRect) {
        var box = item.rec.el.getBoundingClientRect();
        if (box.width || box.height) at = { left: box.left, top: box.top };
      } else if (item.region) {
        at = { left: item.region.left - x, top: item.region.top - y };
      }
      if (!at) return;
      var m = document.createElement("span");
      m.className = "mark";
      m.style.left = Math.round(at.left) + "px";
      m.style.top = Math.round(at.top) + "px";
      m.appendChild(text(String(item.mark)));
      marksBox.appendChild(m);
    });
    marksBox.hidden = !marksBox.firstChild;
  }

  /**
   * The edits, one line per element: its name selects it, the arrow reverts it,
   * and one button copies them all for a coding agent.
   */
  // The edits panel, kept between redraws.
  var changesPanel = null;

  function listChanges() {
    var items = report();
    // The edits panel: its rows and the two buttons under them. They are kept
    // between redraws, so a change that lands while the panel is open does not
    // throw away the scroll position, or a word that is still fading in.
    if (!changesPanel) {
      changesPanel = {};
      changesPanel.list = document.createElement("div");
      changesPanel.list.className = "list";
      changesPanel.actions = document.createElement("div");
      changesPanel.actions.className = "bar2";
      var copy = button("cta", "", "Copy the edits as a prompt for a coding agent", function () {
        copyText(markdown(report()), function (ok) {
          relabel(changesPanel.copy, ok ? "Copied" : "Copy failed");
          setTimeout(function () { relabel(changesPanel.copy, "Copy for an agent"); }, 1600);
        });
      }, "copy");
      copy.appendChild(say("Copy for an agent"));
      changesPanel.copy = copy;
      var save = button("cta ghost", "", "Save the edits to " + CHANGES_FILE + " in the project", function () {
        saveEdits(function (message) {
          relabel(changesPanel.save, message);
          setTimeout(function () { relabel(changesPanel.save, "Save to project"); }, 2400);
        });
      }, "save");
      save.appendChild(say("Save to project"));
      changesPanel.save = save;
      changesPanel.actions.appendChild(copy);
      changesPanel.actions.appendChild(save);
    }
    var list = changesPanel.list;
    // The rows are the edits, and the edits have changed, so the rows are
    // built again. The scroll position is kept: a change that lands while the
    // reader is down the list must not throw them back to the top.
    var top = list.scrollTop;
    while (list.firstChild) list.removeChild(list.firstChild);
    if (!items.length) {
      var empty = document.createElement("p");
      empty.className = "note";
      empty.appendChild(text("No edits yet. Change something on the page and it is listed here."));
      list.appendChild(empty);
    }
    items.forEach(function (item) {
      var line = document.createElement("div");
      line.className = "chg";
      var n = item.props.length + (item.text ? 1 : 0) + (item.comment ? 1 : 0) + (item.created ? 1 : 0) + (item.removed ? 1 : 0) + (item.moved ? 1 : 0) + (item.region ? 1 : 0);
      var name = button("opt", "", "Select " + item.label, function () {
        // A deleted element is off the page, and a box is not an element:
        // there is nothing to frame or edit.
        if (item.removed || !item.rec) return;
        var el = item.rec.el;
        select(el, { el: el, kind: kind(el) });
        show("changes");
      }, "");
      name.disabled = item.removed || !item.rec;
      name.appendChild(text(item.mark + " \u00b7 " + item.label + " \u00b7 " + n + (n === 1 ? " edit" : " edits")));
      var undo = button("ic", svg("undo-2"), "Revert " + item.label, function () {
        // A drawn box reverts by leaving the canvas.
        if (!item.rec) {
          for (var r = regions.length - 1; r >= 0; r--) {
            if (regions[r].mark === item.mark) regions.splice(r, 1);
          }
          show("changes");
          return;
        }
        if (item.rec.el === editing) stopEditing();
        revert(item.rec);
        // The row belongs to the selected element, and its controls went with it.
        if (item.rec.el === selected) {
          select(null);
          refit();
        }
        show("changes");
      }, "");
      line.appendChild(name);
      line.appendChild(undo);
      list.appendChild(line);
    });
    list.scrollTop = top;
    changesPanel.copy.disabled = !items.length;
    changesPanel.save.disabled = !items.length;
    pop.appendChild(list);
    pop.appendChild(changesPanel.actions);
  }

  // The dev server's save endpoint (index.js) and the file it writes.
  var CHANGES_URL = "/__edityy/changes";
  var CHANGES_FILE = ".edityy/changes.json";

  /** The edits without their live elements: what can go over the wire. */
  function plain(items) {
    return items.map(function (item) {
      var out = { label: item.label, selector: item.selector, source: item.source, props: item.props, text: item.text, comment: item.comment, created: item.created, added: item.added, removed: item.removed, moved: item.moved, movedTo: item.movedTo };
      if (item.region) out.region = item.region;
      return out;
    });
  }

  /**
   * Send the edits to the dev server, which writes them into the project for a
   * coding agent to read. A server without the endpoint — Next.js until its
   * route is added — answers 404, and the button says so instead of failing.
   */
  function saveEdits(done) {
    var items = report();
    if (typeof window.fetch !== "function") return done("Cannot save here");
    var body = JSON.stringify({
      page: window.location ? window.location.href : null,
      markdown: markdown(items),
      changes: plain(items),
    });
    window.fetch(CHANGES_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: body,
    }).then(function (r) {
      if (r.status === 404) return done("No save endpoint");
      return r.json().then(function (j) {
        done(j && j.ok ? "Saved to " + j.path : "Save failed");
      });
    }).catch(function () {
      done("Save failed");
    });
  }

  /* ---------------------------------------------------------- variations */

  // The dev server's variation endpoint (index.js). The page writes what the
  // user asked for, polls until the agent answers, and shows the answer here.
  var VARIATIONS_URL = "/__edityy/variations";
  // The values the agent gets: a short list of computed values, so a typical
  // request stays under about 800 characters and the agent never sees the code.
  var CONTEXT_PROPS = ["display", "color", "background-color", "border-color", "border-width", "border-style", "border-radius", "font-family", "font-size", "font-weight", "line-height", "padding", "margin", "width", "height"];
  // How often the page asks whether the agent has answered, and for how long.
  var POLL_DELAY = 1000;
  var MAX_POLLS = 120;

  var variationFor = null; // the element the request is about
  var variationId = ""; // the pending request, "" when there is none
  var variationTimer = 0;
  var variationPolls = 0;
  var variationWords = ""; // what the prompt box says: waiting, or why not
  var variationPrompt = "";
  var openDone = false; // the menu holds the Done card of a text edit
  var variantList = []; // the variations the agent placed
  var variantAt = -1; // the one on the element, -1 for none
  var variantProps = []; // the properties the last variation wrote
  // The rows of the strip, and its Keep button. They are kept between picks,
  // so a pick moves the tick instead of building the strip again.
  var variantRows = [];
  var variantKeep = null;

  /** A request id: random enough that two tabs never share one. */
  function newId() {
    return "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /** What the agent is told about the element: its tag, a selector and values. */
  function contextFor(el) {
    var view = null;
    try {
      view = window.getComputedStyle(el);
    } catch {
      view = null; // a page that cannot be measured still gets a request
    }
    var values = [];
    CONTEXT_PROPS.forEach(function (prop) {
      var value = view ? String(view.getPropertyValue(prop) || "") : "";
      if (value) values.push({ property: prop, value: value.slice(0, 80) });
    });
    return { tag: el.tagName.toLowerCase(), selector: selectorFor(el), values: values };
  }

  /**
   * Ask the dev server for variations of one element. The agent reads the same
   * request over MCP once the user chose Vartest; `failed` is told why a request
   * did not go out.
   */
  function requestVariations(el, count, prompt, failed) {
    if (typeof window.fetch !== "function") return failed("Cannot ask here");
    var id = newId();
    window.fetch(VARIATIONS_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ id: id, count: count, prompt: prompt, element: contextFor(el) }),
    }).then(function (r) {
      // Next.js answers 404 until its route file is added.
      if (r.status === 404) throw new Error("No variations endpoint");
      return r.json();
    }).then(function (j) {
      if (!j || !j.ok) throw new Error((j && j.error) || "The request was refused");
      variationFor = el;
      variationId = j.requestId || id;
      variationPolls = 0;
      pollVariations(); // at once: an answer already waiting is not waited for
    }).catch(function (error) {
      failed(error.message || "Could not ask the dev server");
    });
  }

  /** Ask once for the answer, and again in a moment while there is none. */
  function pollVariations() {
    if (!variationId) return;
    var id = variationId;
    variationPolls += 1;
    if (variationPolls > MAX_POLLS) {
      // Two minutes of asking: the agent is not coming, so the box says so.
      variationId = "";
      variationWords = "The agent did not answer. Connect the Edityy MCP server so it can read the request.";
      openComment = null;
      syncElementMenu();
      return;
    }
    window.fetch(VARIATIONS_URL + "?id=" + encodeURIComponent(id), { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (id !== variationId) return; // the user moved on
        if (!j || !j.ok) throw new Error((j && j.error) || "The answer could not be read");
        if (j.pending || !j.variations) {
          if (variationTimer) clearTimeout(variationTimer);
          variationTimer = setTimeout(pollVariations, POLL_DELAY);
          return;
        }
        showVariants(j.variations);
      })
      .catch(function (error) {
        if (id !== variationId) return;
        variationId = "";
        variationWords = error.message || "Could not reach the dev server";
        openComment = null;
        syncElementMenu();
      });
  }

  /** The answer arrived: the prompt goes away, the strip at the bottom right stays. */
  function showVariants(list) {
    if (variationTimer) clearTimeout(variationTimer);
    variationTimer = 0;
    variationId = "";
    variationPolls = 0;
    variationWords = "";
    variationPrompt = "";
    commentFor = null;
    openComment = null;
    variantList = list;
    variantAt = -1;
    variantProps = [];
    while (elementMenu.firstChild) elementMenu.removeChild(elementMenu.firstChild);
    menuAway();
    paintVariants();
    variantsBox.hidden = false;
    syncElementMenu();
  }

  /**
   * Put one variation on the element. It is written as edits, so it is undoable,
   * revertible, and saved and copied like any other change.
   */
  function pickVariant(index) {
    var variation = variantList[index];
    if (!variation || !variationFor) return;
    var rec = record(variationFor);
    var next = {};
    variation.props.forEach(function (p) { next[propKey(p)] = p.value; });
    // What this variation does not set goes back to the page's own value, so a
    // key press shows the whole variation and never a mix of two. It goes back
    // through applyTo, so undo steps over it like any other write.
    variantProps.forEach(function (prop) {
      if (prop in next) return;
      applyTo(variationFor, prop, rec.set[prop] ? rec.props[prop] : "");
    });
    Object.keys(next).forEach(function (prop) { applyTo(variationFor, prop, next[prop]); });
    variantProps = Object.keys(next);
    variantAt = index;
    // A variation may also set the element's words: leaf text only, so markup is
    // never flattened by a textContent write.
    if (variation.text !== undefined && !variationFor.children.length) previewText(variationFor, variation.text);
    paintVariants();
    refit();
    tally();
  }

  /**
   * The strip: one row per variation, with the key that picks it.
   *
   * The rows are built once, when the strip is drawn, and kept. A redraw on
   * every pick would throw away the row the pointer is on and the words that
   * are still fading in, and the answer to a pick is a tick that moves, not a
   * strip that is built again.
   */
  function paintVariants() {
    if (variantRows.length) {
      // The rows are there: the tick moves and the Keep button says whether
      // there is anything to keep.
      variantRows.forEach(function (row, i) {
        row.setAttribute("aria-pressed", i === variantAt ? "true" : "false");
      });
      if (variantKeep) variantKeep.disabled = variantAt < 0;
      return;
    }
    var head = document.createElement("div");
    head.className = "variants-head";
    var title = document.createElement("p");
    title.className = "variants-title";
    title.appendChild(text("Variations"));
    head.appendChild(title);
    // The strip floats away from the element, so it says which element it
    // varies: a caption, in the muted tone.
    if (variationFor) {
      var of = document.createElement("span");
      of.className = "variants-of";
      of.appendChild(text(variationFor.tagName.toLowerCase()));
      head.appendChild(of);
    }
    var keep = button("variants-keep", "", "Keep the variation on the element", function () {
      closeVariants();
    }, "keep-variation");
    keep.appendChild(say("Keep"));
    // Keep ends the strip, and it can only end it with something on the element.
    keep.disabled = variantAt < 0;
    variantKeep = keep;
    head.appendChild(keep);
    variantsBox.appendChild(head);
    var list = document.createElement("div");
    list.className = "variants-list";
    variantList.forEach(function (variation, i) {
      var row = button("variant", "", "Use " + variation.label, function () { pickVariant(i); }, "variant-" + (i + 1));
      row.setAttribute("aria-pressed", i === variantAt ? "true" : "false");
      var key = document.createElement("span");
      key.className = "key";
      // The tenth row wears 0: there is no key for 10 on a keyboard.
      key.appendChild(text(i === 9 ? "0" : String(i + 1)));
      row.appendChild(key);
      var words = document.createElement("span");
      words.className = "words";
      words.appendChild(text(variation.label));
      row.appendChild(words);
      list.appendChild(row);
      variantRows.push(row);
    });
    variantsBox.appendChild(list);
  }

  /* ------------------------------------------------------------ previews */

  // The agent-placed preview (previews.js). The agent answers `edityy::` in
  // the chat with place_preview, the page polls and paints it here, and Keep
  // makes it an ordinary Edityy edit. Discard puts the page back.
  var PREVIEWS_URL = "/__edityy/previews";
  var previewTimer = 0;
  var previewPolls = 0;
  var previewSeen = ""; // signature of what the box shows, so a poll redraws only on a change
  var previewCurrent = null; // the preview on the canvas now
  var previewRecords = []; // the change records the paint wrote
  var previewRows = []; // the style rows, kept so a pick moves the tick
  var previewKeep = null;
  var previewVariantAt = -1;
  var previewVariantProps = [];
  var previewTarget = null; // the styled element, for a styles preview
  var previewFresh = []; // the inserted elements, for an insert preview
  // More than one up at once: a list with a tick each, no paint on the canvas
  // (several paints could fight over one element), and one batch button.
  var previewList = []; // the previews the checkbox list shows
  var previewChecked = Object.create(null); // id -> ticked
  var previewBoxRows = []; // the tick rows, kept so a toggle does not rebuild
  var previewBatch = null; // the batch button, kept so the words change in place
  var previewVariantAt = -1;
  var previewVariantProps = [];
  var previewTarget = null; // the styled element, for a styles preview
  var previewFresh = []; // the inserted elements, for an insert preview
  var previewStyled = []; // every styles element in the preview: { el, props }

  /** Every element one preview paints: the many-target form, or the old single one. */
  function previewTargets(preview) {
    return preview && Array.isArray(preview.targets) && preview.targets.length ? preview.targets : preview ? [preview] : [];
  }
  function previewStyleTargets(preview) {
    return previewTargets(preview).filter(function (t) { return t.action === "styles"; });
  }
  /** The rows one variant number picks from: the first styles target's looks. */
  function previewRowVariations(preview) {
    var styles = previewStyleTargets(preview);
    return styles.length ? styles[0].variations || [] : [];
  }

  /** Ask once for the agent's previews, and again in a moment while there are none. */
  function pollPreviews() {
    if (!active || typeof window.fetch !== "function") return;
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = 0;
    previewPolls += 1;
    if (previewPolls > MAX_POLLS) return; // the canvas waits quietly: a preview is a gift, not a request
    window.fetch(PREVIEWS_URL, { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) throw new Error((j && j.error) || "The preview could not be read");
        var pending = Array.isArray(j.previews) ? j.previews : [];
        // Only a change in what is up repaints: a poll that reads the same list
        // again would throw away a tick the user just made and the words still
        // fading in.
        var now = pending.map(function (one) { return one.id; }).sort().join(",") + "|" + pending.length;
        if (now === previewSeen) {
          previewTimer = setTimeout(pollPreviews, POLL_DELAY);
          return;
        }
        previewSeen = now;
        showPreviews(pending);
        previewTimer = setTimeout(pollPreviews, POLL_DELAY);
      })
      .catch(function () {
        previewTimer = setTimeout(pollPreviews, POLL_DELAY);
      });
  }

  function previewQuery(selector) {
    if (!selector) return null;
    try {
      return document.querySelector(selector);
    } catch {
      return null; // a selector the page cannot read names nothing on it
    }
  }

  /**
   * Inserted markup: any markup the caller sends.
   * Parses as DOM; script elements get a fresh copy so they run on insert.
   */
  function previewNodes(html) {
    var box = document.createElement("div");
    box.innerHTML = html;
    var banned = /fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|document\.cookie|\beval\s*\(|new\s+Function|importScripts|document\.write\b|window\.location|document\.location|location\s*=(?!=)|location\.href/i;
    var danger = /^\s*((javascript|vbscript)\s*:|data\s*:\s*(text\/html|application\/javascript|application\/xhtml\+xml))/i;
    var external = /^\s*(https?:\/\/|\/\/)/i;
    var scripts = [];
    try { scripts = Array.prototype.slice.call(box.querySelectorAll("script")); } catch { scripts = []; }
    scripts.forEach(function (old) {
      var src = old.getAttribute ? old.getAttribute("src") : null;
      if (src !== null || banned.test(old.textContent || "")) {
        if (old.parentNode) old.parentNode.removeChild(old);
        return;
      }
      var fresh = document.createElement("script");
      fresh.textContent = old.textContent || "";
      if (old.parentNode) old.parentNode.replaceChild(fresh, old);
    });
    var all = [];
    try { all = Array.prototype.slice.call(box.querySelectorAll("*")); } catch { all = []; }
    all.forEach(function (el) {
      var attrs = el.attributes ? Array.prototype.slice.call(el.attributes) : [];
      attrs.forEach(function (a) {
        var key = String(a.name || "").toLowerCase();
        var value = String(a.value || "");
        if (key.indexOf("on") === 0 && banned.test(value)) return el.removeAttribute(a.name);
        if (["href", "src", "action", "formaction", "xlink:href", "poster", "data"].indexOf(key) !== -1 && danger.test(value)) return el.removeAttribute(a.name);
        if ((key === "action" || key === "formaction") && external.test(value)) return el.removeAttribute(a.name);
        if (String(el.tagName || "").toLowerCase() === "iframe" && key === "srcdoc" && /<script|javascript\s*:/i.test(value)) return el.removeAttribute(a.name);
      });
    });
    return Array.prototype.slice.call(box.childNodes);
  }

  /** Put one declaration set on an element, through the same records as a pick. */
  function previewApply(el, props, prev) {
    var rec = record(el);
    var next = {};
    props.forEach(function (p) { next[propKey(p)] = p.value; });
    (prev || previewVariantProps).forEach(function (prop) {
      if (prop in next) return;
      applyTo(el, prop, rec.set[prop] ? rec.props[prop] : "");
    });
    Object.keys(next).forEach(function (prop) { applyTo(el, prop, next[prop]); });
    return Object.keys(next);
  }

  /** Set plain words on a leaf element: no markup is ever written as words. */
  function previewText(el, words) {
    if (!el || typeof words !== "string") return;
    if (el.children && el.children.length) return; // a container keeps its markup
    var rec = record(el);
    if (rec.text === null) rec.text = el.textContent;
    if (rec.html === undefined) rec.html = el.innerHTML;
    var before = el.textContent;
    el.textContent = words;
    if (before !== words) action(rec, "text", before, words);
  }

  /** Paint every element of one agent preview. Inserts and updates are new records; they stay ordinary edits. */
  function paintPreview(preview) {
    previewRecords = [];
    previewVariantProps = [];
    previewVariantAt = -1;
    previewTarget = null;
    previewFresh = [];
    previewStyled = [];
    if (!preview || typeof preview !== "object") return false;
    var painted = true;
    previewTargets(preview).forEach(function (target) {
      if (painted && !paintTarget(target)) painted = false;
    });
    if (!painted) {
      previewFresh.forEach(function (node) {
        if (node.parentElement) node.parentElement.removeChild(node);
      });
      previewRecords.slice().forEach(revert);
      previewRecords = [];
      previewFresh = [];
      previewStyled = [];
      previewVariantProps = [];
      previewTarget = null;
      return false;
    }
    return true;
  }

  /** Paint one element of a preview. A styles element waits for a pick. */
  function paintTarget(preview) {
    if (preview.action === "styles") {
      var el = previewQuery(preview.selector);
      if (!el) return false;
      if (!previewTarget) previewTarget = el;
      previewStyled.push({ el: el, props: [] });
      return true; // the rows paint it: nothing lands until a pick does
    }
    if (preview.action === "insert") {
      var anchor = preview.anchor ? previewQuery(preview.anchor) : null;
      var parent = anchor ? anchor.parentElement : (document.querySelector("main") || document.body);
      if (!parent) return false;
      var nodes = previewNodes(preview.html);
      if (!nodes.length) return false;
      var position = preview.position || "inside-end";
      var before = null;
      if (anchor && position === "after") before = anchor.nextSibling;
      if (anchor && position === "before") before = anchor;
      nodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (position === "inside-start") parent.insertBefore(node, parent.firstChild);
        else if (before) parent.insertBefore(node, before);
        else parent.appendChild(node);
        var rec = record(node);
        rec.created = true;
        rec.createdStyle = node.style ? node.style.cssText : "";
        if (!rec.selector) rec.selector = selectorFor(node);
        previewRecords.push(rec);
        previewFresh.push(node);
      });
      select(previewFresh[0] || null, previewFresh[0] ? { el: previewFresh[0], kind: "container" } : null);
      return !!previewFresh.length;
    }
    if (preview.action === "update") {
      var target = previewQuery(preview.selector);
      if (!target) return false;
      previewTarget = target;
      (preview.props || []).forEach(function (p) { applyTo(target, propKey(p), p.value); });
      if (preview.text !== undefined) previewText(target, preview.text);
      if (preview.html !== undefined) {
        var rec = record(target);
        if (rec.text === null) rec.text = target.textContent;
        if (rec.html === undefined) rec.html = target.innerHTML;
        var was = target.innerHTML;
        target.innerHTML = "";
        previewNodes(preview.html).forEach(function (node) { target.appendChild(node); });
        action(rec, "text", was, target.innerHTML);
      }
      previewRecords.push(record(target));
      select(target, { el: target, kind: "container" });
      return true;
    }
    if (preview.action === "remove") {
      var gone = previewQuery(preview.selector);
      if (!gone || !gone.parentElement) return false;
      var grec = record(gone);
      if (!grec.selector) grec.selector = selectorFor(gone);
      grec.removed = { parent: gone.parentElement, before: gone.nextSibling };
      action(grec, "delete", grec.removed, null);
      gone.parentElement.removeChild(gone);
      previewRecords.push(grec);
      select(null);
      return true;
    }
    return false;
  }

  /** Drop the painted preview: inserted nodes leave, the rest reverts. */
  function unpaintPreview() {
    previewFresh.forEach(function (node) {
      for (var i = previewRecords.length - 1; i >= 0; i--) {
        if (previewRecords[i].el === node) {
          previewRecords.splice(i, 1);
          changes = changes.filter(function (other) { return other !== previewRecords[i]; });
        }
      }
      if (node.parentElement) node.parentElement.removeChild(node);
    });
    previewFresh = [];
    previewRecords.slice().forEach(revert);
    previewRecords = [];
    previewVariantProps = [];
    previewVariantAt = -1;
    previewRows = [];
    previewKeep = null;
    previewTarget = null;
    previewStyled = [];
    previewCurrent = null;
    while (previewBox.firstChild) previewBox.removeChild(previewBox.firstChild);
    previewBox.hidden = true;
  }

  /** Put the checkbox list away, with its ticks and its batch button. */
  function clearPreviewList() {
    previewList = [];
    previewChecked = Object.create(null);
    previewBoxRows = [];
    previewBatch = null;
    while (previewBox.firstChild) previewBox.removeChild(previewBox.firstChild);
    previewBox.hidden = true;
  }

  /** Take whatever the box was showing away: a painted one reverts, a list just leaves. */
  function resetPreviewBox() {
    if (previewCurrent) unpaintPreview();
    else clearPreviewList();
  }

  /** The preview box: the instruction, the rows or the note, and Keep and Discard. */
  function drawPreview(preview) {
    while (previewBox.firstChild) previewBox.removeChild(previewBox.firstChild);
    previewBox.hidden = false;
    var head = document.createElement("div");
    head.className = "variants-head";
    var title = document.createElement("p");
    title.className = "variants-title";
    title.appendChild(text("Preview"));
    head.appendChild(title);
    var id = document.createElement("span");
    id.className = "variants-of";
    id.appendChild(text(preview.id));
    head.appendChild(id);
    previewBox.appendChild(head);
    var line = document.createElement("p");
    line.className = "preview-say";
    line.appendChild(text(preview.instruction));
    previewBox.appendChild(line);
    if (previewRowVariations(preview).length && previewTarget) {
      var list = document.createElement("div");
      list.className = "variants-list";
      previewRowVariations(preview).forEach(function (variation, i) {
        var row = button("variant", "", "Use " + variation.label, function () { pickPreviewVariant(i); }, "preview-" + (i + 1));
        row.setAttribute("aria-pressed", i === previewVariantAt ? "true" : "false");
        var key = document.createElement("span");
        key.className = "key";
        key.appendChild(text(i === 9 ? "0" : String(i + 1)));
        row.appendChild(key);
        var words = document.createElement("span");
        words.className = "words";
        words.appendChild(text(variation.label));
        row.appendChild(words);
        list.appendChild(row);
        previewRows.push(row);
      });
      previewBox.appendChild(list);
    }
    var foot = document.createElement("div");
    foot.className = "preview-foot";
    var keep = button("variants-keep", "", "Keep the preview as an edit", function () { keepPreview(); }, "preview-keep");
    keep.appendChild(say("Keep"));
    keep.disabled = previewStyleTargets(preview).length > 0 && previewVariantAt < 0;
    previewKeep = keep;
    foot.appendChild(keep);
    var discard = button("variants-keep", "", "Discard the preview", function () { discardPreview(); }, "preview-discard");
    discard.appendChild(say("Discard"));
    foot.appendChild(discard);
    previewBox.appendChild(foot);
    refit();
  }

  /** The answer arrived: paint it, then show the box with Keep and Discard. */
  function showPreview(preview) {
    resetPreviewBox();
    previewRows = [];
    previewCurrent = preview;
    if (!paintPreview(preview)) {
      previewCurrent = null;
      previewSeen = "";
      if (typeof window.fetch === "function") {
        window.fetch(PREVIEWS_URL, { method: "DELETE", credentials: "same-origin" }).catch(function () {});
      }
      return;
    }
    drawPreview(preview);
    tally();
  }

  /** The pending previews arrived: one paints as before; several get the checkbox list. */
  function showPreviews(pending) {
    if (variantRows.length) closeVariants();
    if (!pending.length) {
      resetPreviewBox();
      return;
    }
    if (pending.length === 1) {
      showPreview(pending[0]);
      return;
    }
    // Several at once: nothing paints, so several writes can never fight over
    // one element. The user ticks what to keep and presses the batch button.
    resetPreviewBox();
    previewList = pending;
    var live = Object.create(null);
    pending.forEach(function (one) {
      live[one.id] = one.id in previewChecked ? previewChecked[one.id] : true;
    });
    previewChecked = live;
    drawPreviewList();
    refit();
    tally();
  }

  /** One styled look on every styles element, through the same records as a variant. */
  function pickPreviewVariant(index) {
    var preview = previewCurrent;
    if (!preview || !previewTarget) return;
    var picked = false;
    previewStyleTargets(preview).forEach(function (target) {
      var variation = (target.variations || [])[index];
      if (!variation) return;
      var el = previewQuery(target.selector);
      if (!el) return;
      var entry = null;
      previewStyled.forEach(function (one) { if (one.el === el) entry = one; });
      previewVariantProps = previewApply(el, variation.props || [], entry ? entry.props : []);
      if (entry) entry.props = previewVariantProps;
      if (variation.text !== undefined) previewText(el, variation.text);
      if (previewRecords.indexOf(record(el)) === -1) previewRecords.push(record(el));
      picked = true;
    });
    if (!picked) return;
    select(previewTarget, { el: previewTarget, kind: "container" });
    previewVariantAt = index;
    previewRows.forEach(function (row, i) {
      row.setAttribute("aria-pressed", i === previewVariantAt ? "true" : "false");
    });
    if (previewKeep) previewKeep.disabled = false;
    refit();
    tally();
  }

  /** Where one preview aims, in words a reader can follow on the page. */
  function previewWhere(preview) {
    return previewTargets(preview).map(function (target) {
      if (target.action === "insert") {
        if (!target.anchor) return "End of main";
        var place = { after: "After /", before: "Before /", "inside-start": "First inside /" }[target.position] || "End of /";
        return place + target.anchor;
      }
      if (target.action === "remove") return "Takes away /" + target.selector;
      return "/" + target.selector;
    }).join("; ");
  }

  /** The checkbox list: one row per instruction, and one batch button under it. */
  function drawPreviewList() {
    while (previewBox.firstChild) previewBox.removeChild(previewBox.firstChild);
    previewBox.hidden = false;
    var head = document.createElement("div");
    head.className = "variants-head";
    var title = document.createElement("p");
    title.className = "variants-title";
    title.appendChild(text("Previews"));
    head.appendChild(title);
    var of = document.createElement("span");
    of.className = "variants-of";
    of.appendChild(text(String(previewList.length)));
    head.appendChild(of);
    previewBox.appendChild(head);
    var list = document.createElement("div");
    list.className = "variants-list";
    previewBoxRows = [];
    previewList.forEach(function (one, i) {
      var item = document.createElement("div");
      item.className = "preview-item";
      var row = document.createElement("label");
      row.className = "preview-row";
      var tick = document.createElement("input");
      tick.type = "checkbox";
      tick.className = "tick";
      tick.checked = !!previewChecked[one.id];
      tick.setAttribute("aria-label", "Keep this preview");
      tick.dataset.key = "preview-row-" + (i + 1);
      tick.addEventListener("change", function () {
        previewChecked[one.id] = tick.checked;
        syncBatch();
      });
      row.appendChild(tick);
      var mark = document.createElement("span");
      mark.className = "mark";
      mark.setAttribute("aria-hidden", "true");
      mark.innerHTML = svg("check");
      row.appendChild(mark);
      var words = document.createElement("span");
      words.className = "words";
      words.appendChild(text(one.instruction));
      row.appendChild(words);
      // The chevron opens the row's place: where on the page this one lands.
      var detail = document.createElement("p");
      detail.className = "preview-detail";
      detail.hidden = true;
      detail.appendChild(text(previewWhere(one)));
      var more = button("more", svg("chevron-up"), "Show where this change lands", function () {
        var open = row.getAttribute("data-open") === "true";
        row.setAttribute("data-open", open ? "false" : "true");
        detail.hidden = open;
      }, "preview-where-" + (i + 1));
      row.appendChild(more);
      item.appendChild(row);
      item.appendChild(detail);
      list.appendChild(item);
      previewBoxRows.push(tick);
    });
    previewBox.appendChild(list);
    var foot = document.createElement("div");
    foot.className = "preview-foot";
    previewBatch = button("variants-keep", "", "Keep the ticked previews as edits", function () { decideList(); }, "preview-batch");
    previewBatch.appendChild(say("Keep all"));
    foot.appendChild(previewBatch);
    previewBox.appendChild(foot);
    syncBatch();
  }

  /** The batch button in step with the ticks: keep them, or take the lot back. */
  function syncBatch() {
    if (!previewBatch) return;
    var ticked = 0;
    Object.keys(previewChecked).forEach(function (id) {
      if (previewChecked[id]) ticked += 1;
    });
    var keep = ticked > 0;
    previewBatch.disabled = !previewList.length;
    relabel(previewBatch, keep ? "Keep all" : "Discard all changes");
    previewBatch.title = keep ? "Keep the ticked previews, and take the rest back" : "Discard every preview still waiting";
    previewBatch.setAttribute("aria-label", previewBatch.title);
  }

  /** Key 1 to 0 flips the tick on a row of the list, like a variant key does. */
  function toggleRow(index) {
    var tick = previewBoxRows[index];
    if (!tick) return;
    tick.checked = !tick.checked;
    previewChecked[previewList[index].id] = tick.checked;
    syncBatch();
  }

  /** The batch button: keep every ticked one, take the unticked ones back. */
  function decideList() {
    if (!previewList.length) return;
    var decided = previewList.map(function (one) { return { id: one.id, keep: !!previewChecked[one.id] }; });
    // Nothing painted on the canvas, so nothing to put back: the page only
    // hears the decision. The kept ones the agent reads with get_preview.
    decideOnServer(decided);
  }

  /** Escape or leaving the mode: every preview up for a decision goes back. */
  function discardList() {
    if (!previewList.length) {
      resetPreviewBox();
      return;
    }
    decideOnServer(previewList.map(function (one) { return { id: one.id, keep: false }; }));
  }

  /** Post one round of decisions, then put the box away and let a poll catch up. */
  function decideOnServer(decided) {
    if (typeof window.fetch === "function") {
      window.fetch(PREVIEWS_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ decisions: decided }),
      }).catch(function () {});
    }
    resetPreviewBox();
    previewSeen = "";
    refit();
    tally();
  }

  /** Tell the server the user kept it. It stays: it is an ordinary edit now. */
  function keepPreview() {
    var preview = previewCurrent;
    var id = preview && preview.id;
    previewCurrent = null;
    previewRows = [];
    previewKeep = null;
    while (previewBox.firstChild) previewBox.removeChild(previewBox.firstChild);
    previewBox.hidden = true;
    if (id && typeof window.fetch === "function") {
      window.fetch(PREVIEWS_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ id: id, keep: true }),
      }).catch(function () {});
    }
    previewRecords = [];
    previewVariantProps = [];
    previewVariantAt = -1;
    previewTarget = null;
    previewStyled = [];
    previewFresh = [];
    refit();
    tally();
  }

  /** Tell the server the user dropped it, and put the page back. */
  function discardPreview() {
    var id = previewCurrent && previewCurrent.id;
    unpaintPreview();
    previewSeen = "";
    if (id && typeof window.fetch === "function") {
      window.fetch(PREVIEWS_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ id: id, keep: false }),
      }).catch(function () {});
    }
    refit();
    tally();
  }

  /** Put the strip away. A pending request is dropped, so no agent answers it late. */
  function closeVariants() {
    if (variationTimer) clearTimeout(variationTimer);
    variationTimer = 0;
    if (variationId && typeof window.fetch === "function") {
      window.fetch(VARIATIONS_URL, { method: "DELETE", credentials: "same-origin" }).catch(function () {
        // The request outlives the page, and the next one replaces it anyway.
      });
    }
    variationId = "";
    variationPolls = 0;
    variationWords = "";
    variationPrompt = "";
    commentFor = null;
    openComment = null;
    variantList = [];
    variantAt = -1;
    variantProps = [];
    variantRows = [];
    variantKeep = null;
    variationFor = null;
    // The strip leaves the way it came: a copy of it fades out where it
    // stood, and the strip itself is put away at once.
    if (moves(variantsBox)) {
      var ghost = ghostOf(variantsBox, root);
      variantsBox.hidden = true;
      ghost();
    } else {
      variantsBox.hidden = true;
    }
    while (variantsBox.firstChild) variantsBox.removeChild(variantsBox.firstChild);
  }

  /** The menu while an element's words are being typed: the one way out. */
  function doneBox() {
    var box = document.createElement("div");
    box.className = "element-menu-actions";
    var done = button("element-action done", "", "Done editing the text", function () {
      stopEditing();
      syncElementMenu();
    }, "done-editing");
    done.appendChild(say("Done"));
    box.appendChild(done);
    return box;
  }

  /** A line of words in the element card. */
  function noteBox(words) {
    var note = document.createElement("p");
    note.className = "note";
    note.appendChild(text(words));
    return note;
  }

  /** Put a string on the clipboard, by the API where there is one. */
  function copyText(value, done) {
    var nav = window.navigator;
    if (nav && nav.clipboard && nav.clipboard.writeText) {
      nav.clipboard.writeText(value).then(
        function () { done(true); },
        function () { done(copyByHand(value)); }
      );
      return;
    }
    done(copyByHand(value));
  }

  /** The old way, for a page without the clipboard API (plain http, older browsers). */
  function copyByHand(value) {
    try {
      var area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "");
      area.style.cssText = "position:fixed;left:-9999px;top:0";
      pop.appendChild(area);
      area.select();
      var ok = document.execCommand("copy");
      pop.removeChild(area);
      return !!ok;
    } catch {
      return false;
    }
  }

  review.addEventListener("click", function () {
    pressTool("edits");
  });

  /** The edits as Markdown, for scripts and for anything that wants them. */
  window.__edityy_changes = function () {
    return markdown(report());
  };

  /* -------------------------------------------------------------- session */

  // The canvas survives a reload through the dev server, not the browser store.
  // Every change is POSTed to /__edityy/session, restored on load, and the
  // server forgets it when the mode is left. An unreachable server never
  // breaks the editor.
  var SESSION_URL = "/__edityy/session";
  function sessionPath() {
    try {
      var p = window.location && window.location.pathname;
      return p || "/";
    } catch {
      return "/";
    }
  }

  // tally() runs on every keystroke, and keep() finds a selector for every
  // edited element and writes them all. So a run of keys writes once, after the
  // last; leaving the page writes what is still to be written.
  var KEEP_DELAY = 250;
  var keepTimer = 0;
  function keepSoon() {
    if (!keepTimer) keepTimer = setTimeout(keep, KEEP_DELAY);
  }
  if (window.addEventListener) {
    window.addEventListener("pagehide", function () {
      if (keepTimer) keep();
    });
  }

  /** Save the canvas, or forget it once the mode is off. */
  function keep() {
    if (keepTimer) clearTimeout(keepTimer);
    keepTimer = 0;
    if (typeof window.fetch !== "function") return;
    var path = sessionPath();
    if (!active) {
      try {
        window.fetch(SESSION_URL, { method: "DELETE", credentials: "same-origin" }).catch(function () {});
      } catch {}
      return;
    }
    var edits = [];
    changes.forEach(function (rec) {
      if (!rec.el || rec.el.isConnected === false) return;
      var props = {};
      var any = false;
      Object.keys(rec.props).forEach(function (prop) {
        if (OWN[prop]) return;
        props[prop] = {
          before: rec.props[prop],
          set: rec.set[prop],
          was: rec.was[prop],
          now: readProp(rec, prop)
        };
        any = true;
      });
      var text = rec.text !== null && rec.el.textContent !== rec.text ? { before: rec.text, after: rec.el.textContent } : null;
      if (!any && !text && !rec.comment && !rec.created && !(rec.added && rec.added.length) && !rec.location) return;
      if (rec.mark == null) rec.mark = markTop++;
      edits.push({ selector: selectorFor(rec.el), props: props, text: text, comment: rec.comment || null, added: rec.added || [], moved: !!rec.location, mark: rec.mark });
    });
    var savedRegions = regions.map(function (rg) {
      if (rg.mark == null) rg.mark = markTop++;
      return { left: rg.left, top: rg.top, width: rg.width, height: rg.height, comment: rg.comment || null, mark: rg.mark };
    });
    var body = JSON.stringify({ version: 1, savedAt: new Date().toISOString(), path: path, markTop: markTop, edits: edits, regions: savedRegions });
    try {
      window.fetch(SESSION_URL, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: body }).catch(function () {});
    } catch {}
  }

  /**
   * Put a saved session back: the edits on the elements they were made to, and
   * the mode on. An element that is no longer on the page takes its edits with it.
   */
  function resume() {
    if (typeof window.fetch !== "function") return;
    var path = sessionPath();
    var url = SESSION_URL + "?path=" + encodeURIComponent(path);
    var done = function (saved) {
      if (!saved || (saved.v !== 1 && saved.version !== 1) || !Array.isArray(saved.edits)) return;
      if (saved.markTop) markTop = saved.markTop;
      saved.edits.forEach(function (edit) {
        var el = null;
        try {
          el = document.querySelector ? document.querySelector(edit.selector) : null;
        } catch {
          el = null;
        }
        if (!el || (host.contains && host.contains(el))) return;
        var rec = record(el);
        Object.keys(edit.props || {}).forEach(function (prop) {
          var p = edit.props[prop];
          rec.props[prop] = p.before;
          rec.set[prop] = !!p.set;
          rec.was[prop] = p.was;
          writeProp(rec, prop, p.now || "");
        });
        if (edit.text && isLeafText(el) && el.textContent === edit.text.before) {
          rec.text = edit.text.before;
          el.textContent = edit.text.after;
        }
        if (edit.added && edit.added.length) rec.added = edit.added.slice();
        if (typeof edit.comment === "string") rec.comment = edit.comment;
        if (edit.mark != null) {
          rec.mark = edit.mark;
          if (edit.mark >= markTop) markTop = edit.mark + 1;
        }
        if (typeof edit.googleFont === "string") rec.googleFont = edit.googleFont;
      });
      (Array.isArray(saved.regions) ? saved.regions : []).forEach(function (rg) {
        if (!rg || typeof rg !== "object") return;
        var kept = { left: rg.left, top: rg.top, width: rg.width, height: rg.height, comment: rg.comment || null, mark: rg.mark };
        if (kept.mark != null && kept.mark >= markTop) markTop = kept.mark + 1;
        regions.push(kept);
      });
      enter();
      tally();
    };
    try {
      window.fetch(url, { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) done(j.session);
      }).catch(function () {});
    } catch {}
  }

  /* ----------------------------------------------------- keyboard selection */

  // Never a target: not ours, and nothing anyone means to edit.
  var SKIP = /^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT|LINK|META|HEAD|TITLE)$/;

  function selectable(node) {
    return !!node && !!node.tagName && node !== host && !SKIP.test(node.tagName) &&
      node !== document.body && node !== document.documentElement;
  }

  /** The element an arrow moves to from this one, or null at an edge. */
  function neighbour(el, arrow) {
    if (arrow === "ArrowUp") return selectable(el.parentElement) ? el.parentElement : null;
    if (arrow === "ArrowDown") {
      for (var i = 0; i < el.children.length; i++) if (selectable(el.children[i])) return el.children[i];
      return null;
    }
    var parent = el.parentElement;
    if (!parent) return null;
    var list = Array.prototype.filter.call(parent.children, selectable);
    var at = list.indexOf(el) + (arrow === "ArrowRight" ? 1 : -1);
    return list[at] || null;
  }

  /**
   * ↑ the parent, ↓ the first child, ← → the siblings. A nested element is hard
   * to hit with the pointer; one keystroke up from the words gets the box around
   * them. While the caret is in words the arrows are the caret's, so there it
   * takes Alt as well.
   */
  function walkSelection(e) {
    if (!selected || !/^Arrow(Up|Down|Left|Right)$/.test(e.key)) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (editing && !e.altKey) return;
    // A key aimed at our own controls (a focused slider) is theirs.
    if (e.composedPath && e.composedPath().indexOf(host) !== -1) return;
    var next = neighbour(selected, e.key);
    if (!next) return;
    if (e.preventDefault) e.preventDefault();
    select(next, { el: next, kind: kind(next) });
    if (next.scrollIntoView) next.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  /* --------------------------------------------------------- the page pointer */

  var cursorStyleEl = null; // the <style> on the page that carries the pointer

  /**
   * The pointer on the page: one rule carrying it, removed when the mode
   * is off. It stays in the light DOM, so the chrome above it keeps its
   * own cursors, and the grip wears the pointing hand's twin.
   */
  function paintPointer(value) {
    if (cursorStyleEl && cursorStyleEl.parentNode) cursorStyleEl.parentNode.removeChild(cursorStyleEl);
    cursorStyleEl = null;
    if (!value) return;
    cursorStyleEl = document.createElement("style");
    cursorStyleEl.textContent = "html,body,*{cursor:" + value + "!important}";
    (document.head || document.documentElement).appendChild(cursorStyleEl);
  }

  /** The pointer the context wears: Add draws with the precision point. */
  function syncPointer() {
    paintPointer(activeTool === "add" ? PRECISION : POINTER);
  }

  /* ----------------------------------------------------------------- mode */

  function enter() {
    active = true;
    activeTool = "comment";
    // The pill is the closed toolbar: it hides, and the dock stands where it
    // stood. Escape is the way back while it is hidden. The pill hides only
    // once the logo has shrunk: it is the first beat of the choreography,
    // not a cut.
    entering = true;
    buildRow();
    keep();
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("mouseup", onUp, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    // input, not keydown: keydown fires before the browser has changed the
    // words, so measuring there catches the element as it was. This one fires
    // after, which is when the frame has to be re-measured.
    document.addEventListener("input", onEdit, true);
    // The frames are viewport-fixed like everything else, so a scroll moves the
    // element out from under them and they must go with it.
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", refit, true);
    // load does not bubble, so it is caught on the way down: an image that
    // loads above the selection pushes it down the page.
    document.addEventListener("load", onLoad, true);
    previewPolls = 0;
    previewSeen = "";
    pollPreviews(); // an agent may have placed a preview while the page was idle
    // The page pointer: the toolbar's paper, while the mode is on.
    syncPointer();
    shrinkLogo(function () {
      // A close inside the shrink put the mode back off: there is nothing
      // for the dock to stand up for.
      if (!active) return;
      launch.hidden = true;
      dockFromLaunch(); // the bar stands up where the pill was
      syncDock();
      keepDockOnPage(); // whatever hangs off the page comes back inside
      entering = false;
    });
  }

  /**
   * No control gets lost off the page: after the bar stands up, whatever
   * hangs past an edge is pulled back inside, in the same frame the entry
   * plays in, so the draw-out and the stagger land on a bar already home.
   * A dragged pill is narrower than the bar, so the bar can outgrow the
   * corner the pill fitted in.
   */
  function keepDockOnPage() {
    if (dock.hidden) return;
    var box = dock.getBoundingClientRect ? dock.getBoundingClientRect() : null;
    if (!box) return;
    var width = box.width || dock.offsetWidth || 0;
    var height = box.height || dock.offsetHeight || 0;
    var margin = 8;
    var maxLeft = Math.max(margin, (window.innerWidth || 0) - width - margin);
    var maxTop = Math.max(margin, (window.innerHeight || 0) - height - margin);
    var left = Math.max(margin, Math.min(box.left, maxLeft));
    var top = Math.max(margin, Math.min(box.top, maxTop));
    if (left === box.left && top === box.top) return;
    dock.style.left = left + "px";
    dock.style.top = top + "px";
    dock.style.right = "auto";
    dock.style.bottom = "auto";
    dock.setAttribute("data-placed", "true");
  }

  /**
   * The pill and the bar are one thing standing in one place: closing the
   * bar leaves the pill where the bar stood, and opening puts the bar back
   * where the pill is. Where neither was ever moved both keep the corner.
   */
  function dockFromLaunch() {
    if (!launch.style.left) return;
    dock.style.left = launch.style.left;
    dock.style.top = launch.style.top;
    dock.style.right = "auto";
    dock.style.bottom = "auto";
    dock.setAttribute("data-placed", "true");
  }
  /**
   * The pill takes the bar's visual place, not its inline one: a hovered
   * placed dock stands a payback shift left of where its left says. Where
   * the dock was never moved both keep the corner, so the pill is cleared.
   */
  function launchFromDock() {
    if (!dock.style.left) {
      launch.style.left = "";
      launch.style.top = "";
      launch.style.right = "";
      launch.style.bottom = "";
      return;
    }
    var box = !dock.hidden && dock.getBoundingClientRect ? dock.getBoundingClientRect() : null;
    var left = box ? box.left : parseFloat(dock.style.left) || 0;
    var top = box ? box.top : parseFloat(dock.style.top) || 0;
    launch.style.left = left + "px";
    launch.style.top = top + "px";
    launch.style.right = "auto";
    launch.style.bottom = "auto";
  }

  function exit() {
    // First: the pill takes the bar's place while it still has one. The way
    // out unplaces the dock when the fade lands, so anything later in here
    // would copy an already empty place.
    launchFromDock();
    // Anything open closes first: a stale panel would float over the dock on
    // the way back in.
    show("");
    active = false;
    // The mode is off. The pill comes back last, once the dock has gone, so
    // there is never a frame with both in the corner: `restoreLogo` brings
    // it when the exit wave lands.
    entering = false;
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("mousedown", onDown, true);
    document.removeEventListener("mouseup", onUp, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("input", onEdit, true);
    window.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", refit, true);
    document.removeEventListener("load", onLoad, true);
    // Exiting always puts the page back exactly as it was.
    stopEditing();
    closeVariants();
    // The page pointer goes with the mode: the page wears its own again.
    paintPointer("");
    if (previewCurrent) discardPreview();
    else if (previewList.length) discardList();
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = 0;
    previewPolls = 0;
    previewSeen = "";
    if (moving) {
      var location = record(moving).location;
      location.parent.insertBefore(moving, location.before && location.before.parentElement === location.parent ? location.before : null);
    }
    changes.slice().forEach(revert);
    insertion = null;
    moving = null;
    drawing = null;
    regionFor = null;
    openComment = null;
    regions = [];
    regionBox.hidden = true;
    menuAway();
    pointerX = null;
    pointerY = null;
    delete insertLine.dataset.on;
    history = [];
    future = [];
    select(null);
    hideHover();
    keep(); // the mode is off: nothing to bring back on the next load
  }

  /** The hover frame is only meaningful while the pointer is still on it. */
  function hideHover() {
    hoverBox.hidden = true;
  }

  /**
   * The page scrolled: the frames are fixed to the viewport, so the element has
   * moved and the selection frame has to move with it. The hover frame is
   * dropped instead, because where the pointer now is has nothing to do with
   * what it was over a moment ago.
   */
  /**
   * The words changed while they were being edited — typed, pasted, deleted.
   *
   * The frame is a fixed box drawn at the last measured size, so a line added
   * leaves the box a line too short and a deletion leaves it too tall. Measured
   * on the next tick, because the browser reflows the element after this event.
   */
  function onEdit(e) {
    // Our own field, so its words are not the page's: typing a comment must not
    // count as an edit or redraw the list under the caret.
    if (e && e.composedPath && e.composedPath().indexOf(host) !== -1) return;
    typedAt = Date.now();
    if (editing) {
      var rec = record(editing);
      var after = editing.textContent;
      if (after !== editingTextBefore) {
        var top = history[history.length - 1];
        if (top && top.open && top.kind === "text" && top.rec === rec) {
          top.after = after;
          top.at = typedAt;
        } else {
          action(rec, "text", editingTextBefore, after);
          history[history.length - 1].open = true;
        }
      }
      setTimeout(refit, 0);
    }
    tally();
  }

  function onScroll() {
    hideHover();
    inFrame("refit", refit);
  }

  function onLoad() {
    if (selectedItems.length) inFrame("refit", refit);
  }

  /**
   * Watch the selection for the page moving it on its own.
   *
   * A scroll, a resize and our own writes refit already. This is for the rest:
   * the element wraps onto another line, or a section above it opens. The
   * selected elements and every box around them are watched, because content
   * that grows above an element grows the box that holds them both. A box is
   * measured by the observer, not by us, and the frame is measured again only
   * when one of those sizes really changed, once in the frame.
   */
  var watcher = typeof window.ResizeObserver === "function" ? new window.ResizeObserver(onResize) : null;
  var watched = [];
  var watchedSizes = [];

  function watchSelection(items) {
    if (!watcher) return;
    if (items.length === watched.length && items.every(function (el, i) { return el === watched[i]; })) return;
    // A new selection is a new set of boxes: the old ones are let go first.
    watcher.disconnect();
    watched = items.slice();
    watchedSizes = [];
    var boxes = [];
    items.forEach(function (el) {
      // Up to the first box already watched: the ones above it are watched too.
      for (var node = el; node && boxes.indexOf(node) === -1; node = node.parentElement) {
        boxes.push(node);
        watcher.observe(node);
      }
    });
  }

  function onResize(entries) {
    var changed = false;
    entries.forEach(function (entry) {
      var size = entry.contentRect.width + "x" + entry.contentRect.height;
      var was = watchedSizes.filter(function (seen) { return seen.el === entry.target; })[0];
      // The first report of a box is its size when it was watched, not a change.
      if (!was) watchedSizes.push({ el: entry.target, size: size });
      else if (was.size !== size) {
        was.size = size;
        changed = true;
      }
    });
    if (changed) inFrame("refit", refit);
  }

  /**
   * Run `fn` in the next animation frame, once however often it is asked for
   * before then; the last `fn` asked for is the one that runs. A pointer move or
   * a scroll can fire many times in one frame, and measuring for each is work
   * the screen never shows. Without requestAnimationFrame, `fn` runs now.
   */
  var queued = {};
  function inFrame(key, fn) {
    if (typeof window.requestAnimationFrame !== "function") return fn();
    var waiting = !!queued[key];
    queued[key] = fn;
    if (waiting) return;
    window.requestAnimationFrame(function () {
      var run = queued[key];
      queued[key] = null;
      if (run && active) run();
    });
  }
  /**
   * Put the selection frame back where the element now is.
   *
   * One place, called from everything that can move the element: a scroll (the
   * frame is viewport-fixed, so the element slides out from under it), a resize,
   * a change this session made, and a keystroke. Typing is the case that is easy
   * to miss — the text grows or shrinks, the box does not, and the frame ends up
   * around words that are no longer there.
   */
  function refit() {
    // A framework that re-renders replaces the node the selection stands on.
    // The same element is taken up again by the selector that names it: a
    // selection cleared here hides the dock's row, and a dock with no controls
    // reads as a dock that does not work. Only an element really gone clears it.
    if (selected && selected.isConnected === false) {
      var again = null;
      try {
        again = document.querySelector ? document.querySelector(selectorFor(selected)) : null;
      } catch {
        again = null; // a selector the page no longer parses the same way
      }
      if (again && again.tagName === selected.tagName && again !== host && !(host.contains && host.contains(again))) {
        // The record follows the element onto its new node. What the old node
        // wore went with it, so the values shown now are the page's own.
        for (var i = 0; i < changes.length; i++) {
          if (changes[i].el === selected) changes[i].el = again;
        }
        select(again, { el: again, kind: kind(again) });
      } else {
        select(null);
        hint.textContent = "Selected element was replaced";
        hint.style.left = "50%";
        hint.style.top = "16px";
        hint.style.transform = "translateX(-50%)";
        hint.hidden = false;
        setTimeout(function () {
          if (hint.textContent === "Selected element was replaced") hint.hidden = true;
        }, REPLACED_HOLD);
      }
    }
    syncSelectionFrames();
    // Marks are viewport-fixed like the frames: a scroll moves the element
    // out from under them, so they are drawn again where it now is. A box
    // whose comment is open stays drawn with them.
    if (regionFor) {
      var held = regionView(regionFor);
      regionBox.style.left = held.left + "px";
      regionBox.style.top = held.top + "px";
      regionBox.style.width = (held.right - held.left) + "px";
      regionBox.style.height = (held.bottom - held.top) + "px";
      regionBox.hidden = false;
    }
    paintMarks();
    // A comment card put away by the scroll comes back when its element
    // comes back, so a hidden card is synced too.
    if ((!elementMenu.hidden || commentFor || regionFor || openComment) && !moving) syncElementMenu();
    // The hover frame was measured when the pointer last moved. Whatever made
    // this re-measure may have resized the element under it, so it is dropped
    // until the next move draws it again where it belongs.
    hideHover();
    if (moving && pointerX !== null) showMoveInsertion(pointerX, pointerY);
  }

  function showMoveInsertion(x, y) {
    var hit = pickAt(x, y);
    var target = hit && hit.el;
    for (var node = target; node; node = node.parentElement) {
      if (node === moving) {
        insertion = null;
        delete insertLine.dataset.on;
        return;
      }
    }
    if (!target || !target.parentElement || target.parentElement === host) {
      insertion = null;
      delete insertLine.dataset.on;
      return;
    }
    var children = hit.kind === "container"
      ? Array.prototype.filter.call(target.children || [], function (el) { return el !== moving; })
      : [];
    var parent = hit.kind === "container" ? target : target.parentElement;
    var siblings = children.length || hit.kind === "container"
      ? children
      : Array.prototype.filter.call(parent.children, function (el) { return el !== moving; });
    var spot = spotAmong(siblings, x, y, parent);
    insertion = { parent: parent, before: spot.before };
    drawLine(spot.line);
  }

  /**
   * The sibling the pointer is in front of, and the line that shows the gap.
   *
   * A row reads the pointer's x and a column reads its y. A grid or a wrapping
   * flex row is both: the pointer picks a row first, then a side in that row.
   * Reading y alone put every drop in a grid in front of the first item of a
   * row, so the second and third places in the row could not be reached.
   */
  function spotAmong(siblings, x, y, parent) {
    var style = window.getComputedStyle(parent);
    var display = style.getPropertyValue("display");
    var horizontal = /^(TABLE|TBODY|THEAD|TFOOT|TR|UL|OL|DL)$/.test(parent.tagName) ||
      (/^(flex|inline-flex)$/.test(display) && style.getPropertyValue("flex-direction").indexOf("row") === 0);
    var wraps = /^(grid|inline-grid)$/.test(display) ||
      (horizontal && /^wrap/.test(style.getPropertyValue("flex-wrap")));
    var bounds = parent.getBoundingClientRect();
    var rects = siblings.map(function (el) { return el.getBoundingClientRect(); });
    if (wraps && rects.length) return spotInRows(siblings, rects, x, y);
    var coordinate = horizontal ? x : y;
    var before = null;
    var boundary = rects.length ? null : coordinate;
    for (var i = 0; i < rects.length; i++) {
      var start = horizontal ? rects[i].left : rects[i].top;
      var end = horizontal ? rects[i].right : rects[i].bottom;
      if (coordinate < (start + end) / 2) {
        before = siblings[i];
        boundary = i === 0 ? start : ((horizontal ? rects[i - 1].right : rects[i - 1].bottom) + start) / 2;
        break;
      }
      boundary = end;
    }
    return {
      before: before,
      line: horizontal
        ? { left: boundary, top: bounds.top, width: 2, height: bounds.height }
        : { left: bounds.left, top: boundary, width: bounds.width, height: 2 },
    };
  }

  /** The same, for siblings laid out in rows that wrap. */
  function spotInRows(siblings, rects, x, y) {
    // Siblings that share a row with this one: their boxes overlap top to bottom.
    var sharesRow = function (i) {
      return rects.some(function (r, j) { return j !== i && r.top < rects[i].bottom && r.bottom > rects[i].top; });
    };
    var beside = function (r, left) { return { left: left, top: r.top, width: 2, height: r.height }; };
    var above = function (r) { return { left: r.left, top: r.top, width: r.width, height: 2 }; };
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      var prev = i ? rects[i - 1] : null;
      // The pointer is above this row, so the gap is at the end of the row before.
      if (y < r.top) {
        var endOfRow = prev && y >= prev.top;
        return { before: siblings[i], line: endOfRow ? beside(prev, prev.right) : above(r) };
      }
      if (y > r.bottom) continue;
      var row = sharesRow(i);
      if (row ? x < (r.left + r.right) / 2 : y < (r.top + r.bottom) / 2) {
        var left = prev && prev.top < r.bottom && prev.bottom > r.top ? (prev.right + r.left) / 2 : r.left;
        return { before: siblings[i], line: row ? beside(r, left) : above(r) };
      }
    }
    var last = rects[rects.length - 1];
    return {
      before: null,
      line: sharesRow(rects.length - 1) ? beside(last, last.right) : { left: last.left, top: last.bottom, width: last.width, height: 2 },
    };
  }

  function drawLine(line) {
    insertLine.style.left = line.left + "px";
    insertLine.style.top = line.top + "px";
    insertLine.style.width = line.width + "px";
    insertLine.style.height = line.height + "px";
    insertLine.dataset.on = "on";
  }

  function insertElement(x, y) {
    showMoveInsertion(x, y);
    if (!insertion || !insertion.parent.insertBefore) return;
    var rec = record(moving);
    var before = rec.moveFrom;
    insertion.parent.insertBefore(moving, insertion.before || null);
    action(rec, "move", before, { parent: moving.parentElement, before: moving.nextSibling });
    delete rec.moveFrom;
    moving = null;
    insertion = null;
    delete insertLine.dataset.on;
    syncSelectionFrames();
    syncElementMenu();
    syncDock();
    tally();
  }

  /** The Add drag starts: a box from this point, drawn on the next move. */
  function onDown(e) {
    if (!active || activeTool !== "add" || moving || editing) return;
    if (e.composedPath && e.composedPath().indexOf(host) !== -1) return;
    if (e.button !== undefined && e.button !== 0) return;
    drawing = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY };
  }

  /** The Add drag ends: a big enough box opens its comment box. */
  function onUp(e) {
    if (!drawing) return;
    var start = drawing;
    drawing = null;
    if (activeTool !== "add") {
      regionBox.hidden = true;
      return;
    }
    var left = Math.min(start.x0, e.clientX);
    var top = Math.min(start.y0, e.clientY);
    var width = Math.abs(e.clientX - start.x0);
    var height = Math.abs(e.clientY - start.y0);
    if (width < REGION_MIN || height < REGION_MIN) {
      regionBox.hidden = true;
      return;
    }
    var x = window.pageXOffset || window.scrollX || 0;
    var y = window.pageYOffset || window.scrollY || 0;
    // The box stays drawn while its comment is open: the comment is about it.
    regionBox.style.left = left + "px";
    regionBox.style.top = top + "px";
    regionBox.style.width = width + "px";
    regionBox.style.height = height + "px";
    regionBox.hidden = false;
    regionFor = { left: Math.round(left + x), top: Math.round(top + y), width: Math.round(width), height: Math.round(height), comment: null, mark: null };
    openComment = null;
    select(null);
    syncElementMenu();
  }

  function onMove(e) {
    var x = e.clientX;
    var y = e.clientY;
    pointerX = x;
    pointerY = y;
    inFrame("hover", function () {
      // No tool on means browse: the pointer finds nothing and the hover
      // frame stays away.
      if (!activeTool) {
        hideHover();
        return;
      }
      // Add is freeform: no element is outlined or picked, only the box drawn.
      if (drawing || activeTool === "add") {
        hideHover();
        return;
      }
      if (moving) {
        showMoveInsertion(x, y);
        hideHover();
        return;
      }
      var el = textAt(x, y);
      if (!el) {
        hideHover();
        return;
      }
      place(hoverBox, el.getBoundingClientRect(), el);
      hoverBox.hidden = false;
    });
  }

  function onClick(e) {
    if (e.composedPath && e.composedPath().indexOf(host) !== -1) return;
    if (editing) {
      var inWords = pickAt(e.clientX, e.clientY);
      if (inWords && (inWords.el === editing || (editing.contains && editing.contains(inWords.el)))) return;
    }
    // Browse keeps every page click: no tool is on, so nothing is picked.
    if (!activeTool) return;
    e.preventDefault();
    e.stopPropagation();
    // Add draws its box with a drag: a click alone picks nothing.
    if (activeTool === "add" || regionFor) return;
    if (moving) {
      insertElement(e.clientX, e.clientY);
      return;
    }
    var hit = pickAt(e.clientX, e.clientY);
    if (e.shiftKey) extendSelection(hit && hit.el);
    else select(hit && hit.el, hit);
  }

  /** Escape backs out one level: the open control first, then the mode. */
  function onKey(e) {
    var field = e.target;
    var pageField = field && (field.tagName === "INPUT" || field.tagName === "TEXTAREA" || field.tagName === "SELECT" || field.isContentEditable);
    if (pageField && !(e.composedPath && e.composedPath().indexOf(host) !== -1)) return;
    // 1 to 9 pick a variation while the strip is up, and 0 picks the tenth,
    // which is what the strip says on each row. A digit in a field belongs to the
    // field.
    if (!variantsBox.hidden && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && /^[0-9]$/.test(String(e.key || ""))) {
      var typing = editing || pageField;
      var index = e.key === "0" ? 9 : Number(e.key) - 1;
      if (!typing && index < variantList.length) {
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        pickVariant(index);
      }
      return;
    }
    if (previewBox && !previewBox.hidden && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && /^[0-9]$/.test(String(e.key || ""))) {
      var previewTyping = editing || pageField;
      var previewIndex = e.key === "0" ? 9 : Number(e.key) - 1;
      if (!previewTyping && previewList.length) {
        // The checkbox list: a digit flips the tick on that row.
        if (previewIndex < previewBoxRows.length) {
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
          toggleRow(previewIndex);
        }
      } else if (!previewTyping && previewCurrent && previewIndex < previewRowVariations(previewCurrent).length) {
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        pickPreviewVariant(previewIndex);
      }
      return;
    }
    if (e.shiftKey && !e.metaKey && !e.ctrlKey && !editing && String(e.key || "").toLowerCase() === "a" && !(e.composedPath && e.composedPath().indexOf(host) !== -1)) {
      e.preventDefault();
      e.stopPropagation();
      autoLayout();
      return;
    }
    // C, A and E press the three tools, the way the buttons do: a second
    // press of the one that is on drops to browse. A letter in a field
    // belongs to the field, and one in the dock belongs to the dock, so
    // both are already answered above or by the host check.
    if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && !editing && !(e.composedPath && e.composedPath().indexOf(host) !== -1)) {
      var toolKey = { c: "comment", a: "add", e: "edits" }[String(e.key || "").toLowerCase()];
      if (toolKey) {
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        pressTool(toolKey);
        return;
      }
    }
    // Alt+S drops to browse: no tool on, nothing open, nothing picked. The
    // pointer then finds nothing until a tool is pressed again.
    if (e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey && String(e.key || "").toLowerCase() === "s") {
      if (!editing) {
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        activeTool = "";
        show("");
        select(null);
        syncRow();
        syncElementMenu();
        syncPointer();
      }
      return;
    }
    // The dock is mounted after the page, so Tab from the page would go through
    // every link first. With an element selected, Tab from the page goes to the
    // dock. From there Tab and Shift+Tab go on as usual, so focus is not held.
    if (e.key === "Tab" && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && selected && !editing &&
        !dock.hidden && !row.hidden && !(e.composedPath && e.composedPath().indexOf(host) !== -1)) {
      var stop = rowStop();
      if (stop && stop.focus) {
        e.preventDefault();
        e.stopPropagation();
        stop.focus();
      }
      return;
    }
    if (e.key === "Escape") {
      // One press leaves the whole mode: whatever is open — a control, the
      // words, a box, the strip — goes with it, unsaved. There is no
      // unwinding to get stuck in, and the pill is the way back in.
      exit();
      syncRow();
      return;
    }
    // Enter edits the words. Delete removes the element. One tool at a time.
    if ((e.key === "Enter" || e.key === "Delete") && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      if (!editing && selected && selectedItems.length === 1 && !(e.composedPath && e.composedPath().indexOf(host) !== -1)) {
        if (e.key === "Enter" && selectedKind === "text" && canEditText(selected)) {
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
          editText(selected);
          syncElementMenu();
          return;
        }
        if (e.key === "Delete") {
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
          deleteSelected();
          return;
        }
      }
    }
    // ⌘Z / Ctrl+Z undoes, ⇧⌘Z / Ctrl+Shift+Z / Ctrl+Y redoes.
    var mod = e.metaKey || e.ctrlKey;
    var k = String(e.key || "").toLowerCase();
    var isUndo = mod && k === "z" && !e.shiftKey;
    var isRedo = mod && ((k === "z" && e.shiftKey) || (k === "y" && e.ctrlKey && !e.metaKey));
    if (!isUndo && !isRedo) {
      walkSelection(e);
      return;
    }
    // Typed words are the browser's to undo: it keeps the caret and the text
    // history, which a style undo knows nothing about. So while the caret is in
    // words typed into since the last drag, the key goes to the browser.
    var top = isUndo ? history[history.length - 1] : future[future.length - 1];
    if (editing && (top && top.kind === "text" || !top || typedAt > top.at)) return;
    if (isUndo ? undo() : redo()) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  launch.addEventListener("click", function (e) {
    e.stopPropagation();
    // A drag lets go over the pill: that press moved it, it does not open it.
    if (pillMoved) { pillMoved = false; return; }
    window.dispatchEvent(new CustomEvent("edityy:launcher-click"));
    if (active) exit();
    else enter();
  });

  // The pill itself drags, with no handle and no special cursor: a press that
  // travels past a tap moves the pill, a tap still opens. The bar stands up
  // where a dragged pill is, and the pill comes back where a dragged bar was.
  var pillMoved = false;
  (function () {
    var down = false;
    var startX = 0;
    var startY = 0;
    var offX = 0;
    var offY = 0;
    launch.addEventListener("pointerdown", function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (launch.setPointerCapture && e.pointerId !== undefined) launch.setPointerCapture(e.pointerId);
      var box = launch.getBoundingClientRect ? launch.getBoundingClientRect() : null;
      offX = box ? e.clientX - box.left : 0;
      offY = box ? e.clientY - box.top : 0;
      startX = e.clientX;
      startY = e.clientY;
      down = true;
    });
    launch.addEventListener("pointermove", function (e) {
      if (!down) return;
      if (!pillMoved && Math.abs(e.clientX - startX) < 6 && Math.abs(e.clientY - startY) < 6) return;
      pillMoved = true;
      placeLaunch(e.clientX - offX, e.clientY - offY);
    });
    function letGo() { down = false; }
    launch.addEventListener("pointerup", letGo);
    launch.addEventListener("pointercancel", letGo);
  })();

  // The close chip shows on a hover over the bar, and stays while the
  // pointer is in a warm zone around the bar: the chip sits half outside
  // the bar, so hover alone would drop it on the way to the X. The zone is
  // the bar padded by WARM_PAD, no timer. A click outside the chrome cools
  // it at once.
  var WARM_PAD = 32;
  function coolDock() { if (dock.classList) dock.classList.remove("dock-warm"); }
  dock.addEventListener("mouseenter", function () { if (dock.classList) dock.classList.add("dock-warm"); });
  if (document.addEventListener) document.addEventListener("pointermove", function (e) {
    if (!dock.classList.contains("dock-warm")) return;
    if (dock.hidden) { coolDock(); return; }
    var r = dock.getBoundingClientRect();
    if (e.clientX < r.left - WARM_PAD || e.clientX > r.right + WARM_PAD || e.clientY < r.top - WARM_PAD || e.clientY > r.bottom + WARM_PAD) coolDock();
  }, { passive: true });
  if (document.addEventListener) document.addEventListener("click", function (e) {
    if (e.composedPath && e.composedPath().indexOf(host) !== -1) return;
    coolDock();
  });
  var closeBtn = $("dock-close");
  closeBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    exit();
    syncRow();
  });

  (document.body || document.documentElement).appendChild(host);





  // Not now, and not at load either: a framework hydrating the page compares its
  // own markup with the DOM, and an edit put back before it is done is a
  // mismatch it reports (React does, and keeps going after load). An idle
  // callback runs once the page's scheduled work has drained, which is after
  // hydration; the timeout keeps a busy page from never getting its edits back.
  var settle = function () {
    if (window.requestIdleCallback) window.requestIdleCallback(resume, { timeout: 3000 });
    else setTimeout(resume, 300);
  };
  if (document.readyState === "complete") setTimeout(settle, 0);
  else if (window.addEventListener) window.addEventListener("load", function () { setTimeout(settle, 0); });
})();