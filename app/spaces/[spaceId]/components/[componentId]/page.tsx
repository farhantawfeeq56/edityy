import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteComponent, saveComponent, setComponentUsage } from "@/app/actions";
import { getComponent, getSpace, listComponentUsage } from "@/app/db";
import { Card, Field, TextArea, danger, submit, when } from "@/app/ui";

export default async function ComponentPage(props: PageProps<"/spaces/[spaceId]/components/[componentId]">) {
  const { spaceId, componentId } = await props.params;
  const [space, component, usage] = await Promise.all([
    getSpace(spaceId),
    getComponent(componentId),
    listComponentUsage(componentId),
  ]);
  if (!space || !component || component.space_id !== spaceId) notFound();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <Link className="text-sm text-neutral-500 hover:underline" href={`/spaces/${spaceId}/components`}>
            ← Component library
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{component.name}</h1>
        </div>
      </header>

      <Card title="Details">
        <form action={saveComponent} className="flex flex-col gap-3">
          <input type="hidden" name="space_id" value={spaceId} />
          <input type="hidden" name="id" value={componentId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="name" label="Name" defaultValue={component.name} />
            <Field name="file_path" label="File path" defaultValue={component.file_path} placeholder="app/components/HeroSection.tsx" />
          </div>
          <TextArea name="description" label="Description" defaultValue={component.description} />
          <button className={`${submit} self-start`} type="submit">Save changes</button>
        </form>
      </Card>

      <Card title="Usage">
        <form action={setComponentUsage} className="flex flex-col gap-3">
          <input type="hidden" name="space_id" value={spaceId} />
          <input type="hidden" name="id" value={componentId} />
          <TextArea
            name="page_paths"
            label="Pages using this component (one path per line)"
            rows={5}
            defaultValue={usage.map((u) => u.page_path).join("\n")}
          />
          <button className={`${submit} self-start`} type="submit">Save usage</button>
        </form>
      </Card>

      <Card title="Danger zone">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-neutral-500">Updated {when(component.updated_at)}</p>
          <form action={deleteComponent}>
            <input type="hidden" name="space_id" value={spaceId} />
            <input type="hidden" name="id" value={componentId} />
            <button className={danger} type="submit">Delete component</button>
          </form>
        </div>
      </Card>
    </div>
  );
}