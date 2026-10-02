import type { ReactNode } from "react";
export { ago } from "./ago";

export const input =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green-100";

export const label = "block text-sm font-medium text-neutral-500";

// mint drives action, always with ink text (see DESIGN.md)
export const submit =
  "rounded-md bg-green-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:opacity-90 disabled:opacity-50";

export const danger =
  "rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50";

export function Card({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-neutral-100 p-5">
      {title && (
        <header className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Field({ name, label: text, defaultValue, placeholder }: { name: string; label: string; defaultValue?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className={label}>{text}</span>
      <input className={`mt-1 ${input}`} name={name} defaultValue={defaultValue ?? ""} placeholder={placeholder} />
    </label>
  );
}

export function TextArea({ name, label: text, defaultValue, rows = 3 }: { name: string; label: string; defaultValue?: string; rows?: number }) {
  return (
    <label className="block">
      <span className={label}>{text}</span>
      <textarea className={`mt-1 ${input}`} name={name} rows={rows} defaultValue={defaultValue ?? ""} />
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-neutral-500">{children}</p>;
}

// A not-built-yet panel: neutral fill, dashed hairline, ink title. The dash is
// the tell — a solid border here would claim the feature exists.
export function Pending({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-100 p-10 text-center">
      <p className="text-base font-semibold tracking-tight">{title}</p>
      <p className="mx-auto mt-2 max-w-[35rem] text-sm text-neutral-500">{children}</p>
    </div>
  );
}

// Errors stay red on purpose: the design says orange never sits behind text,
// and a destructive alert is not a content state.
export function Error({ message }: { message?: string | string[] }) {
  if (!message) return null;
  const text = Array.isArray(message) ? message[0] : message;
  return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{text}</p>;
}

export function Status({ value }: { value: string }) {
  const ok = value === "running";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ok ? "bg-green-100 text-neutral-900" : "bg-neutral-200 text-neutral-600"}`}>
      {value}
    </span>
  );
}

export function when(iso: string) {
  return new Date(iso).toLocaleString();
}