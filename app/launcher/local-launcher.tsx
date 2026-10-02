"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { input, submit } from "@/app/ui";

function Frame({ url }: { url: string }) {
  return (
    <iframe
      title={`Edityy view of ${url}`}
      src={`/launcher/proxy?url=${encodeURIComponent(url)}`}
      className="h-[70vh] w-full rounded-md border border-neutral-300 bg-white"
    />
  );
}

function Connect() {
  const params = useSearchParams();
  const [url, setUrl] = useState(params.get("url") ?? "http://localhost:4000");
  const [connected, setConnected] = useState(params.get("url") ?? "http://localhost:4000");

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setConnected(url.trim());
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-neutral-500">Website running on localhost</span>
        <input
          className={input}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="http://localhost:4000"
          spellCheck={false}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button className={submit} type="submit">
          Connect
        </button>
        <span className="text-sm text-neutral-500">
          V1: the launcher is the whole feature. Clicking it only logs to the console.
        </span>
      </div>
      {connected && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-neutral-500">
            Showing <span className="font-medium break-all text-neutral-900">{connected}</span> through Edityy —{" "}
            <button className="underline" onClick={() => setConnected("")} type="button">
              disconnect
            </button>
          </p>
          <Frame key={connected} url={connected} />
        </div>
      )}
    </form>
  );
}

export function LocalLauncher() {
  return (
    <Suspense>
      <Connect />
    </Suspense>
  );
}
