import type { ReactNode } from "react";

export const input =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900";

export const label = "block text-sm font-medium text-neutral-700";

export const submit =
  "rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50";

export const danger =
  "rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50";

export function Card({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      {title && (
        <header className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold tracking-wide text-neutral-500 uppercase">{title}</h2>
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

export function Error({ message }: { message?: string | string[] }) {
  if (!message) return null;
  const text = Array.isArray(message) ? message[0] : message;
  return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{text}</p>;
}

export function Status({ value }: { value: string }) {
  const ok = value === "running";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ok ? "bg-green-100 text-green-800" : "bg-neutral-200 text-neutral-600"}`}>
      {value}
    </span>
  );
}

export function when(iso: string) {
  return new Date(iso).toLocaleString();
}