import Link from "next/link";
import { notFound } from "next/navigation";
import { saveComponent } from "@/app/actions";
import { getSpace, listComponents } from "@/app/db";
import { Card, Empty, Error, Field, TextArea, submit } from "@/app/ui";

export default async function ComponentsPage(props: PageProps<"/spaces/[spaceId]/components">) {
  const { spaceId } = await props.params;
  const [space, components] = await Promise.all([getSpace(spaceId), listComponents(spaceId)]);
  if (!space) notFound();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Component library</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Components belong to this space only. The code stays in the codebase.
        </p>
      </header>

      <Error message={(await props.searchParams).error} />

      <Card>
        <form action={saveComponent} className="flex flex-col gap-3">
          <input type="hidden" name="space_id" value={spaceId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="name" label="Name" placeholder="HeroSection" />
            <Field name="file_path" label="File path" placeholder="app/components/HeroSection.tsx" />
          </div>
          <TextArea name="description" label="Description" />
          <button className={`${submit} self-start`} type="submit">Add component</button>
        </form>
      </Card>

      {components.length === 0 ? (
        <Empty>No components yet. Add the first one above.</Empty>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {components.map((component) => (
            <li key={component.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="min-w-0">
                <Link className="font-medium hover:underline" href={`/spaces/${spaceId}/components/${component.id}`}>
                  {component.name}
                </Link>
                <p className="truncate text-sm text-neutral-500">{component.file_path || "No file path"}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}