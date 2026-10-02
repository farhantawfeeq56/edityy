import Link from "next/link";
import { notFound } from "next/navigation";
import { updateCodebase } from "@/app/actions";
import { getCodebase, getSpace } from "@/app/db";
import { Card, Field, submit } from "@/app/ui";

export default async function CodebaseSettingsPage(props: PageProps<"/spaces/[spaceId]/settings/codebase">) {
  const { spaceId } = await props.params;
  const [space, codebase] = await Promise.all([getSpace(spaceId), getCodebase(spaceId)]);
  if (!space) notFound();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1>Codebase connection</h1>
        <p className="mt-1 text-sm text-neutral-500">
          The repository Edityy treats as the source of truth for this space.
        </p>
      </header>

      <Card>
        <form action={updateCodebase} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="space_id" value={spaceId} />
          <div className="sm:col-span-2">
            <Field
              name="repo_url"
              label="Repository URL"
              defaultValue={codebase?.repo_url}
              placeholder="https://github.com/you/site"
            />
          </div>
          <Field name="branch" label="Branch" defaultValue={codebase?.branch} placeholder="main" />
          <Field name="root_dir" label="Root dir" defaultValue={codebase?.root_dir} placeholder="apps/web" />
          <Field name="framework" label="Framework" defaultValue={codebase?.framework} placeholder="next" />
          <div className="flex items-end">
            <button className={submit} type="submit">Save connection</button>
          </div>
        </form>
      </Card>

      <p className="text-sm text-neutral-500">
        Component files are resolved relative to the root dir.{" "}
        <Link className="underline" href={`/spaces/${spaceId}/components`}>Open the component library</Link>.
      </p>
    </div>
  );
}