import Link from "next/link";
import "./edityy.css";

const palette = [
  ["Canvas", "#FAF9F6", "The page around the work", "workspace"],
  ["Surface", "#FFFFFF", "Floating controls", "paper"],
  ["Ink", "#25241F", "Primary text and tools", "graphite"],
  ["Brand gold", "#D4A72C", "Selection and primary action", "violet"],
  ["Warning", "#FFF3D6", "Changed or needs attention", "lime"],
  ["Error", "#C9362B", "Destructive or attention", "coral"],
] as const;

const principles = [
  ["The page stays in charge", "Editing controls orbit the selected content. Keep the live page visible so every adjustment has context."],
  ["Selection is a precise promise", "Use one clear outline, consistent handles, and a small set of unmistakable states. Never rely on color alone."],
  ["Reveal depth on demand", "Start with the likely action. Put detailed values, advanced controls, and uncommon options one step deeper."],
  ["Every change has an answer", "Show what changed, whether it is saved, and how to undo it. A tool should never leave a user guessing."],
];

export function DesignPreview() {
  return (
    <main className="edy-page">
      <header className="edy-topbar">
        <Link className="edy-brand" href="/design" aria-label="Edityy design system guide">
          <span className="edy-mark" aria-hidden="true"><i /><i /><i /><i /></span> edityy
        </Link>
        <nav className="edy-nav" aria-label="Guide sections">
          <a href="#system">System</a><a href="#color">Color</a><a href="#type">Type</a><a href="#controls">Controls</a><a href="#states">States</a>
        </nav>
        <Link className="edy-back" href="/docs">Product documentation <span>↗</span></Link>
      </header>

      <div className="edy-frame">
        <aside className="edy-rail" aria-label="On this page">
          <span>EDITYY / VISUAL LANGUAGE</span>
          <a href="#system">The system</a><a href="#color">Color roles</a><a href="#type">Typography</a><a href="#controls">Control grammar</a><a href="#states">Feedback states</a><a href="#principles">Principles</a>
          <small>AN ORIGINAL SYSTEM<br />BUILT FOR VISUAL EDITING</small>
        </aside>

        <article className="edy-main">
          <section className="edy-hero" id="system">
            <div className="edy-hero-copy">
              <p className="edy-overline"><span /> THE EDITYY DESIGN SYSTEM</p>
              <h1>Keep the page<br />in <em>view.</em></h1>
              <p className="edy-intro">A visual language for editing real websites in place: precise enough for detailed work, quiet enough to keep the page—not the tools—at the center.</p>
              <a className="edy-hero-link" href="#controls">Explore the controls <b>↓</b></a>
            </div>
            <div className="edy-editor" role="img" aria-label="Synthetic Edityy editing interface showing a selected headline and floating controls">
              <div className="edy-editor-top"><span className="edy-editor-brand"><i /> edityy</span><span className="edy-editor-path">studio.site / home</span><span className="edy-save"><i /> Sample state</span></div>
              <div className="edy-editor-canvas">
                <div className="edy-site-nav"><b>FIELDNOTES</b><span>Stories&nbsp;&nbsp;&nbsp; About&nbsp;&nbsp;&nbsp; Contact</span></div>
                <div className="edy-site-copy"><small>THE ART OF MAKING</small><div className="edy-selection"><i /><i /><i /><i /><span>Make room<br />for good ideas.</span><b>TEXT · H1</b></div><p>Thoughtful spaces for the work that matters.</p><button>Discover the studio <span>↗</span></button></div>
                <div className="edy-tool-float"><span className="edy-tool-active">Text</span><span>Bold</span><span>Align</span><i /><span>More</span><b>Done</b></div>
                <div className="edy-editor-hint"><kbd>⌘</kbd><kbd>Z</kbd><span>Undo last edit</span></div>
              </div>
              <div className="edy-editor-foot"><span><i /> Heading selected</span><span>Synthetic interface study</span></div>
            </div>
          </section>

          <div className="edy-ribbon"><span>LIVE PAGE FIRST</span><i /><span>TOOLS FOLLOW CONTEXT</span><i /><span>CHANGES STAY REVERSIBLE</span></div>

          <section className="edy-section edy-color" id="color">
            <div className="edy-section-head"><div><span className="edy-index">COLOR ROLES</span><h2>Signals with a job.</h2></div><p>Most of the interface stays neutral. Color identifies where the user is, what changed, and which action deserves attention.</p></div>
            <div className="edy-palette">{palette.map(([name, hex, role, tone]) => <div className="edy-swatch" key={name}><div className={`edy-chip ${tone}`} /><div className="edy-swatch-name"><b>{name}</b><code>{hex}</code></div><small>{role}</small></div>)}</div>
            <div className="edy-color-rule"><span className="edy-rule-symbol">Aa</span><p><b>Selection is not decoration.</b> Brand gold marks the active target and primary editing actions. Pair every color cue with an outline, label, icon, or state change.</p></div>
          </section>

          <section className="edy-section" id="type">
            <div className="edy-section-head"><div><span className="edy-index">TYPE SCALE</span><h2>Readable at tool speed.</h2></div><p>Use a clean interface sans for controls and explanations. Reserve monospaced type for values that need exact comparison—not for atmosphere.</p></div>
            <div className="edy-type-table">
              <div className="edy-type-row edy-type-head"><span>ROLE</span><span>SPECIMEN</span><span>SIZE / LINE</span><span>USE</span></div>
              <div className="edy-type-row"><b>Display</b><strong className="edy-display-sample">Edit in context.</strong><code>48 / 1.0</code><small>Guide titles</small></div>
              <div className="edy-type-row"><b>Section</b><strong className="edy-section-sample">Selection &amp; layout</strong><code>28 / 1.15</code><small>Panel headings</small></div>
              <div className="edy-type-row"><b>Body</b><strong className="edy-body-sample">The page stays visible while you make a change.</strong><code>15 / 1.5</code><small>Instructions</small></div>
              <div className="edy-type-row"><b>Control</b><strong className="edy-control-sample">Font size</strong><code>12 / 1.3</code><small>Buttons &amp; labels</small></div>
              <div className="edy-type-row"><b>Value</b><strong className="edy-value-sample">24 px&nbsp;&nbsp; #D4A72C</strong><code>11 / 1.4</code><small>Measurements</small></div>
            </div>
          </section>

          <section className="edy-section" id="controls">
            <div className="edy-section-head"><div><span className="edy-index">CONTROL GRAMMAR</span><h2>Compact, not cryptic.</h2></div><p>Keep controls close to the selected element. Use familiar input patterns, explicit labels, and enough spacing for confident pointer and keyboard use.</p></div>
            <div className="edy-controls-demo">
              <div className="edy-popover">
                <div className="edy-popover-title"><span>Text</span><span className="edy-breadcrumb">Selected element <b>⌄</b></span></div>
                <label className="edy-field-label">Font family</label><div className="edy-select">System sans <span>⌄</span></div>
                <div className="edy-field-pair"><label><span>Size</span><div className="edy-input">24 <small>px</small></div></label><label><span>Weight</span><div className="edy-select">600 <span>⌄</span></div></label></div>
                <label className="edy-field-label">Color</label><div className="edy-color-input"><i /> <span>#25241F</span><kbd>↗</kbd></div>
                <div className="edy-align-row"><span className="selected">L</span><span>C</span><span>R</span><i /><span>Top</span><span>Mid</span></div>
                <div className="edy-popover-foot"><span><kbd>⌘</kbd><kbd>Z</kbd> Undo</span><button>Apply</button></div>
              </div>
              <div className="edy-control-notes"><div><span>A</span><p><b>Direct manipulation</b> Adjust in place; retain the selected content as context.</p></div><div><span>B</span><p><b>Progressive detail</b> Show common settings first. Advanced controls stay discoverable, not dominant.</p></div><div><span>C</span><p><b>Safe by default</b> Make undo, cancel, and Done easy to find at the moment they matter.</p></div></div>
            </div>
          </section>

          <section className="edy-section" id="states">
            <div className="edy-section-head"><div><span className="edy-index">FEEDBACK STATES</span><h2>Never leave a change ambiguous.</h2></div><p>Feedback describes the state and the next step. Keep the words visible; color supports the message, it never carries it alone.</p></div>
            <div className="edy-state-list">
              <div><span className="edy-state-mark state-idle" /><b>Idle</b><span>Ready for a selection</span><small>Neutral outline; controls stay quiet.</small></div>
              <div><span className="edy-state-mark state-active" /><b>Selected</b><span>Heading selected</span><small>Gold frame, corner handles, element label.</small></div>
              <div><span className="edy-state-mark state-changed" /><b>Unsaved</b><span>2 edits not saved</span><small>Warning cue with an explicit count.</small></div>
              <div><span className="edy-state-mark state-saved" /><b>Saved</b><span>All changes saved</span><small>Quiet confirmation; no blocking toast.</small></div>
              <div><span className="edy-state-mark state-error" /><b>Error</b><span>Couldn’t save changes</span><small>Explain what happened and offer Retry.</small></div>
            </div>
          </section>

          <section className="edy-section edy-principles" id="principles">
            <div className="edy-section-head"><div><span className="edy-index">WORKING PRINCIPLES</span><h2>Tools recede.<br />Confidence stays.</h2></div><p>Edityy’s visual system is designed around the delicate boundary between changing a page and losing sight of the page.</p></div>
            <div className="edy-principles-list">{principles.map(([title, description], index) => <div key={title}><span>{String(index + 1).padStart(2, "0")}</span><b>{title}</b><p>{description}</p></div>)}</div>
          </section>
          <footer className="edy-footer"><span>EDITYY / ORIGINAL VISUAL SYSTEM STUDY</span><Link href="/docs">Explore product documentation ↗</Link></footer>
        </article>
      </div>
    </main>
  );
}
