"use client";

import { useState } from "react";
import { input, submit } from "@/app/ui";

export function LocalLauncher() {
  const [url, setUrl] = useState("http://localhost:3000");
  // The target's own page, not a proxy: Edityy is a layer on top of the real
  // site, not a copy of it.
  const [target, setTarget] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const raw = url.trim();
        setTarget(/^https?:\/\//i.test(raw) ? raw : `http://${raw}`);
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-neutral-500">Your site</span>
        <input
          className={input}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="http://localhost:3000"
          spellCheck={false}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button className={submit} type="submit">
          Open in frame
        </button>
        <span className="text-sm text-neutral-500">V1: clicking the launcher only logs to the console.</span>
      </div>
      {target && (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-sm text-neutral-500">
            Your real site, in a frame. Scroll it, use it — the launcher is inside it.
            <button className="ml-2 underline" onClick={() => setTarget(null)} type="button">
              close
            </button>
          </p>
          <iframe
            key={target}
            title={`Preview of ${target}`}
            src={target}
            className="h-[70vh] w-full rounded-md border border-neutral-300 bg-white"
          />
        </div>
      )}
    </form>
  );
}
