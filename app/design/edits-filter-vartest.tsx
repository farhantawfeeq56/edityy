"use client";

import { useEffect, useState } from "react";

const names = [
  "Tabs",
  "Grouped sections",
  "Summary line",
  "Dropdown",
  "Ready toggle",
  "Progress rail",
  "Search field",
  "Stepper",
  "Split columns",
  "Badges only",
] as const;

type State = "exploring" | "ready";

const tasks: { name: string; origin: string; detail: string; state: State; waiting?: boolean }[] = [
  { name: "Hero headline", origin: "Comment", detail: "Waiting for agent…", state: "exploring", waiting: true },
  { name: "Hero headline", origin: "Comment", detail: "3 variants ready", state: "exploring" },
  { name: "Intro paragraph", origin: "Agent", detail: "2 variants ready", state: "exploring" },
  { name: "Nav links", origin: "Canvas session", detail: "Approved & sent to agent", state: "ready" },
  { name: "CTA button", origin: "Comment", detail: "Approved & sent to agent", state: "ready" },
];

function Card({ task }: { task: (typeof tasks)[number] }) {
  return (
    <div className={`edy-filter-card${task.waiting ? " is-waiting" : ""}`}>
      <div className="edy-filter-top">
        <span className="edy-filter-name">{task.name}</span>
        <span className="edy-filter-origin">{task.origin}</span>
      </div>
      <p className="edy-filter-sub">
        <i className={`edy-filter-dot${task.waiting ? " is-waiting" : ""}`} />
        {task.detail}
      </p>
    </div>
  );
}

function Badge({ state }: { state: State }) {
  return <span className={`edy-filter-badge is-${state}`}>{state === "ready" ? "Ready" : "Select"}</span>;
}

/** Ten filter treatments beyond the All/Select/Ready tabs. Keys 1-9 and 0 switch. */
export function EditsFilterVartest() {
  const [variant, setVariant] = useState(0);
  const [filter, setFilter] = useState<State | "all">("all");
  const [query, setQuery] = useState("");
  const [step, setStep] = useState(0);

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

  const counts = {
    all: tasks.length,
    exploring: tasks.filter((t) => t.state === "exploring").length,
    ready: tasks.filter((t) => t.state === "ready").length,
  };
  const shown = tasks.filter((t) => filter === "all" || t.state === filter);
  const searched = tasks.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()));
  const stepped = tasks[step % tasks.length];
  const exploring = tasks.filter((t) => t.state === "exploring");
  const ready = tasks.filter((t) => t.state === "ready");

  return (
    <>
      <div className={`edy-filter-panel is-f${variant + 1}`}>
        <div className="edy-filter-head">
          <b>Edits</b>
          <span>{tasks.length} tasks</span>
        </div>

        {variant === 0 && (
          <div className="edy-filter-tabs" role="radiogroup" aria-label="Filter edits">
            {(["all", "exploring", "ready"] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={filter === key}
                className={filter === key ? "is-on" : ""}
                onClick={() => setFilter(key)}
              >
                {key === "all" ? "All" : key === "exploring" ? "Select" : "Ready"} · {counts[key]}
              </button>
            ))}
          </div>
        )}

        {variant === 2 && (
          <button type="button" className="edy-filter-summary" onClick={() => setFilter(filter === "all" ? "exploring" : filter === "exploring" ? "ready" : "all")}>
            {counts.exploring} need pick · {counts.ready} ready — show: {filter === "all" ? "all" : filter === "exploring" ? "needs pick" : "ready"}
          </button>
        )}

        {variant === 3 && (
          <label className="edy-filter-dropdown">
            Show
            <select value={filter} onChange={(e) => setFilter(e.target.value as State | "all")} aria-label="Filter edits">
              <option value="all">All · {counts.all}</option>
              <option value="exploring">Needs pick · {counts.exploring}</option>
              <option value="ready">Ready · {counts.ready}</option>
            </select>
          </label>
        )}

        {variant === 4 && (
          <label className="edy-filter-toggle">
            <input type="checkbox" checked={filter === "ready"} onChange={() => setFilter(filter === "ready" ? "all" : "ready")} />
            <span>Ready only</span>
          </label>
        )}

        {variant === 5 && (
          <div className="edy-filter-rail" role="radiogroup" aria-label="Filter edits">
            <div className="edy-filter-bar">
              <i style={{ width: `${(counts.ready / counts.all) * 100}%` }} />
            </div>
            <div className="edy-filter-rail-btns">
              {(["all", "exploring", "ready"] as const).map((key) => (
                <button key={key} type="button" aria-pressed={filter === key} className={filter === key ? "is-on" : ""} onClick={() => setFilter(key)}>
                  {key === "all" ? `All ${counts.all}` : key === "exploring" ? `${counts.exploring} to pick` : `${counts.ready} ready`}
                </button>
              ))}
            </div>
          </div>
        )}

        {variant === 6 && (
          <input
            className="edy-filter-search"
            type="search"
            placeholder="Filter edits…"
            aria-label="Filter edits"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}

        {variant === 7 && (
          <div className="edy-filter-stepper">
            <button type="button" aria-label="Previous task" onClick={() => setStep((s) => (s + tasks.length - 1) % tasks.length)}>‹</button>
            <span>{(step % tasks.length) + 1} / {tasks.length} · {stepped.detail}</span>
            <button type="button" aria-label="Next task" onClick={() => setStep((s) => (s + 1) % tasks.length)}>›</button>
          </div>
        )}

        <div className="edy-filter-list">
          {variant === 1 ? (
            <>
              <p className="edy-filter-group">Needs pick · {exploring.length}</p>
              {exploring.map((t, i) => <Card key={`e${i}`} task={t} />)}
              <p className="edy-filter-group">Ready · {ready.length}</p>
              {ready.map((t, i) => <Card key={`r${i}`} task={t} />)}
            </>
          ) : variant === 7 ? (
            <Card task={stepped} />
          ) : variant === 8 ? (
            <div className="edy-filter-split">
              <div>
                <p className="edy-filter-group">Select · {exploring.length}</p>
                {exploring.map((t, i) => <Card key={`e${i}`} task={t} />)}
              </div>
              <div>
                <p className="edy-filter-group">Ready · {ready.length}</p>
                {ready.map((t, i) => <Card key={`r${i}`} task={t} />)}
              </div>
            </div>
          ) : variant === 9 ? (
            tasks.map((t, i) => (
              <div key={i} className="edy-filter-badged">
                <Card task={t} />
                <Badge state={t.state} />
              </div>
            ))
          ) : variant === 6 ? (
            searched.map((t, i) => <Card key={i} task={t} />)
          ) : (
            shown.map((t, i) => <Card key={i} task={t} />)
          )}
        </div>
      </div>
      <nav className="edy-count-vartest edy-asked-vartest" aria-label="Edits filter styles">
        <span className="edy-count-vartest-label">Filter · {variant + 1}/10</span>
        <div role="group" aria-label="Choose an edits filter">
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
