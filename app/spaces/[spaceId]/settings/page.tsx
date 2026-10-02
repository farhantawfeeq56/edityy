import { notFound } from "next/navigation";
import { deleteSpace, updateSpaceSettings } from "@/app/actions";
import { getApp, getCodebase, getSpace } from "@/app/db";
import { Card, Error, Field, Status, TextArea, danger, submit } from "@/app/ui";
import { updateApp } from "@/app/actions";

export default async function SpaceSettingsPage(props: PageProps<"/spaces/[spaceId]/settings">) {
  const { spaceId } = await props.params;
  const [space, codebase, app] = await Promise.all([
    getSpace(spaceId),
    getCodebase(spaceId),
    getApp(spaceId),
  ]);
  if (!space) notFound();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1>Space settings</h1>
      </header>

      <Error message={(await props.searchParams).error} />

      <Card title="Space">
        <form action={updateSpaceSettings} className="flex flex-col gap-3">
          <input type="hidden" name="space_id" value={spaceId} />
          <Field name="name" label="Name" defaultValue={space.name} />
          <TextArea name="description" label="Description" defaultValue={space.description} />
          <button className={`${submit} self-start`} type="submit">Save</button>
        </form>
      </Card>

      <Card title="Running app" action={<Status value={app?.status ?? "stopped"} />}>
        <form action={updateApp} className="flex flex-col gap-3">
          <input type="hidden" name="space_id" value={spaceId} />
          <Field
            name="run_url"
            label="Preview URL"
            defaultValue={app?.run_url}
            placeholder="http://localhost:3000"
          />
          <label className="block">
            <span className="block text-sm font-medium text-neutral-700">Status</span>
            <select
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
              name="status"
              defaultValue={app?.status ?? "stopped"}
            >
              <option value="stopped">Stopped</option>
              <option value="running">Running</option>
              <option value="error">Error</option>
            </select>
          </label>
          <button className={`${submit} self-start`} type="submit">Save</button>
        </form>
      </Card>

      <Card title="Danger zone">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-neutral-500">
            Deleting this space also deletes its components{codebase?.repo_url ? " and disconnects its codebase" : ""}.
          </p>
          <form action={deleteSpace}>
            <input type="hidden" name="space_id" value={spaceId} />
            <input type="hidden" name="name" value={space.name} />
            <button className={danger} type="submit">Delete space</button>
          </form>
        </div>
      </Card>
    </div>
  );
}