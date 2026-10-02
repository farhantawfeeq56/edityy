
import Link from "next/link";

export default function Landing() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-20 sm:px-8">
      <p className="text-sm font-medium text-neutral-500">A visual editing layer for code-based websites</p>
      <h1 className="mt-4 text-5xl sm:text-6xl" style={{ lineHeight: 1.05, letterSpacing: "-0.04em" }}>
        Edit your website visually. Keep your codebase.
      </h1>
      <p className="mt-6 max-w-xl text-base text-neutral-600">
        Edityy sits on top of the site you already run. Preview changes, shape them visually, and hand a
        reviewable change set to your coding agent. Your code stays the source of truth.
      </p>
      <Link className="mt-8 w-fit rounded-md bg-green-100 px-4 py-2 text-sm font-medium text-neutral-900" href="/launcher">
        Add the launcher to your site
      </Link>
      </main>
  );
}