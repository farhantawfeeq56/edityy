"use client";

import { useEffect, useState } from "react";

const names = [
  "Status dot",
  "Group headers",
  "Top hairline",
  "Skeleton chips",
  "Queue banner",
  "State badge",
  "Collapsed line",
  "Pinned top",
  "Dim and spinner",
  "Timeline rail",
] as const;

function ReadyCard() {
  return (
    <div className="edy-asked-card">
      <div className="edy-asked-top">
        <span className="edy-asked-mark">2</span>
        <span className="edy-asked-name">Hero headline</span>
        <span className="edy-asked-origin">Comment</span>
      </div>
      <p className="edy-asked-sub">
        <i className="edy-asked-dot is-ready" />
        3 variants ready — pick one
      </p>
      <div className="edy-asked-chips">
        <span className="is-on">1</span>
        <span>2</span>
        <span>3</span>
      </div>
    </div>
  );
}

function WaitingCard({ index }: { index: number }) {
  if (index === 6) {
    return (
      <div className="edy-asked-card is-line">
        <i className="edy-asked-dot is-waiting" />
        <span className="edy-asked-name">Hero headline</span>
        <span className="edy-asked-line-note">with the agent…</span>
      </div>
    );
  }
  return (
    <div className={`edy-asked-card is-waiting${index === 8 ? " is-dim" : ""}`}>
      {index === 2 && <b className="edy-asked-hairline" />}
      <div className="edy-asked-top">
        <span className="edy-asked-mark">1</span>
        <span className="edy-asked-name">Hero headline</span>
        <span className="edy-asked-origin">Comment</span>
        {index === 5 && <span className="edy-asked-badge">Waiting</span>}
        {index === 7 && <span className="edy-asked-tag">Up next</span>}
      </div>
      <p className="edy-asked-sub">
        <i className="edy-asked-dot is-waiting" />
        Waiting for agent{index === 9 ? " — asked 12s ago" : "…"}
      </p>
      {index === 3 ? (
        <div className="edy-asked-chips is-skeleton" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      ) : index === 8 ? (
        <div className="edy-asked-chips">
          <span className="edy-asked-spinner" aria-label="Working" />
          <span className="edy-asked-spin-note">Agent is writing variants…</span>
        </div>
      ) : (
        <p className="edy-asked-ask">“Make it bolder, keep the gold”</p>
      )}
    </div>
  );
}

/** Ten non-tab treatments for the asked state. Keys 1-9 and 0 switch. */
export function AskedStateVartest() {
  const [variant, setVariant] = useState(0);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if ((event.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable=true]")) return;
      const index = event.key === "0" ? 9 : Number(event.key) - 1;
      if (index >= 0 && index < names.length) setVariant(index);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <div className={`edy-asked-panel is-v${variant + 1}`}>
        <div className="edy-asked-head">
          <b>Edits</b>
          <span>2 tasks</span>
        </div>
        {variant === 4 && <p className="edy-asked-banner">1 ask with the agent — answers land below</p>}
        <div className="edy-asked-list">
          {variant === 1 && <p className="edy-asked-group">Waiting for agent</p>}
          {variant === 9 ? (
            <div className="edy-asked-timeline">
              <span className="edy-asked-stop is-now">Asked</span>
              <WaitingCard index={variant} />
              <span className="edy-asked-stop">Pick</span>
              <ReadyCard />
            </div>
          ) : (
            <>
              <WaitingCard index={variant} />
              {variant === 1 && <p className="edy-asked-group">Ready to pick</p>}
              {variant === 7 && <p className="edy-asked-pin-note">Waiting asks stay pinned on top</p>}
              <ReadyCard />
            </>
          )}
        </div>
      </div>
      <nav className="edy-count-vartest edy-asked-vartest" aria-label="Asked state styles">
        <span className="edy-count-vartest-label">Asked · {variant + 1}/10</span>
        <div role="group" aria-label="Choose an asked state">
          {names.map((name, index) => (
            <button
              key={name}
              type="button"
              aria-label={`${index === 9 ? 0 : index + 1}: ${name}`}
              aria-pressed={variant === index}
              onClick={() => setVariant(index)}
            >
              {index === 9 ? 0 : index + 1}
            </button>
          ))}
        </div>
        <span className="edy-count-vartest-name">{names[variant]}</span>
      </nav>
    </>
  );
}
