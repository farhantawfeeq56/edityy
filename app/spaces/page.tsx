import Link from "next/link";
import { createSpace } from "../actions";
import { listActivity, listSpaces } from "../db";
import { ago } from "../ago";
import { SpaceRail, initial } from "../space-rail";
import { Card, Empty, Error, Field, submit } from "../ui";

export default async function SpacesPage(props: PageProps<"/spaces">) {
  const [spaces, activity] = await Promise.all([listSpaces(), listActivity(20)]);

  return (
    <div className="flex min-h-full flex-col">
      {/* One header for every dashboard page: the logo is the way home. */}
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-6 py-3.5 sm:px-8 lg:px-10">
          <Link href="/spaces" className="shrink-0 text-lg font-semibold tracking-tight">
            Edityy
          </Link>
          <Link href="/settings/account" className="text-sm text-neutral-500 hover:text-neutral-900">
            Account
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10 sm:px-8 lg:px-10 lg:py-12">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl">Your spaces.</h1>
            <p className="mt-2 max-w-md text-sm text-neutral-500">
              Pick up where you left off, or jump into a space.
            </p>
          </div>

          {/* The form lives in a <details>, so the button above is the whole
              interaction — no client state to open it. */}
          <details className="group relative">
            <summary className={`${submit} cursor-pointer list-none justify-center`}>New Space</summary>
            <div className="absolute right-0 z-20 mt-2 w-80">
              <Card>
                <form action={createSpace} className="flex flex-col gap-3">
                  <Field name="name" label="Name" placeholder="Marketing site" />
                  <Field name="description" label="Description" placeholder="What this space is for" />
                  <button className={`${submit} self-start`} type="submit">
                    Create space
                  </button>
                </form>
              </Card>
            </div>
          </details>
        </header>

        <Error message={(await props.searchParams).error} />

        <section className="mt-8">
          {spaces.length === 0 ? (
            <Empty>No spaces yet. Create the first one above.</Empty>
          ) : (
            <SpaceRail spaces={spaces} />
          )}
        </section>

        <section className="mt-12 border-t border-neutral-200 pt-8">
          <h2 className="text-2xl font-semibold tracking-tight">Recent Activity</h2>
          {activity.length === 0 ? (
            <Empty>Nothing yet.</Empty>
          ) : (
            <ul className="mt-3 divide-y divide-neutral-200">
              {activity.map((entry) => (
                <li key={entry.id} className="flex items-center gap-4 py-3.5">
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-lilac text-sm font-semibold"
                  >
                    {initial(entry.space_name || entry.summary)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {entry.space_id ? (
                        <Link href={`/spaces/${entry.space_id}`} className="hover:underline">
                          {entry.space_name}
                        </Link>
                      ) : null}
                      {entry.space_id ? " · " : null}
                      {entry.summary}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-neutral-500">{ago(entry.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}