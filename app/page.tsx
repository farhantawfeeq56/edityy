import Link from "next/link";
import { createSpace } from "./actions";
import { listActivity, listSpaces } from "./db";
import { Card, Error, Field, submit, when } from "./ui";

export default async function Dashboard(props: PageProps<"/">) {
  const [spaces, activity] = await Promise.all([listSpaces(), listActivity()]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold">Spaces</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Each space is one project, with its own codebase and components.
        </p>
      </header>

      <Error message={(await props.searchParams).error} />

      <Card>
        <form action={createSpace} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field name="name" label="Name" placeholder="Marketing site" />
          </div>
          <div className="flex-1">
            <Field name="description" label="Description" placeholder="What this space is for" />
          </div>
          <button className={submit} type="submit">
            Create space
          </button>
        </form>
      </Card>

      {spaces.length === 0 ? (
        <p className="text-sm text-neutral-500">No spaces yet. Create one above.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {spaces.map((space) => (
            <li key={space.id}>
              <Link
                href={`/spaces/${space.id}`}
                className="block rounded-lg border border-neutral-200 bg-white p-5 hover:border-neutral-400"
              >
                <div className="font-medium">{space.name}</div>
                <div className="mt-1 line-clamp-2 text-sm text-neutral-500">
                  {space.description || "No description"}
                </div>
                <div className="mt-3 text-xs text-neutral-400">Created {when(space.created_at)}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-neutral-500 uppercase">
          Recent activity
        </h2>
        {activity.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
            {activity.map((entry) => (
              <li key={entry.id} className="flex items-baseline justify-between gap-4 px-5 py-3">
                <span className="text-sm">
                  {entry.space_id ? (
                    <Link
                      className="font-medium hover:underline"
                      href={`/spaces/${entry.space_id}`}
                    >
                      {entry.space_name}
                    </Link>
                  ) : null}
                  {entry.space_id ? " · " : null}
                  {entry.summary}
                </span>
                <span className="shrink-0 text-xs text-neutral-400">{when(entry.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}