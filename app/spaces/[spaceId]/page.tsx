import Link from "next/link";
import { notFound } from "next/navigation";
import { getApp, getCodebase, getSpace, getSpaceComponentCount, listComponents } from "@/app/db";
import { Card, Empty, Status, when } from "@/app/ui";

export default async function SpaceOverview(props: PageProps<"/spaces/[spaceId]">) {
  const { spaceId } = await props.params;
  const [space, codebase, app, components] = await Promise.all([
    getSpace(spaceId),
    getCodebase(spaceId),
    getApp(spaceId),
    listComponents(spaceId),
  ]);
  if (!space) notFound();

  const count = await getSpaceComponentCount(spaceId);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1>{space.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">{space.description || "No description"}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Project info">
          <dl className="grid gap-2 text-sm">
            <Row label="Space ID" value={<code className="text-xs">{space.id}</code>} />
            <Row label="Created" value={when(space.created_at)} />
            <Row label="Updated" value={when(space.updated_at)} />
            <Row label="Components" value={String(count)} />
          </dl>
        </Card>

        <Card title="Connected codebase">
          {codebase?.repo_url ? (
            <dl className="grid gap-2 text-sm">
              <Row label="Repository" value={codebase.repo_url} />
              <Row label="Branch" value={codebase.branch || "—"} />
              <Row label="Root dir" value={codebase.root_dir || "."} />
              <Row label="Framework" value={codebase.framework || "—"} />
            </dl>
          ) : (
            <Empty>
              No codebase connected.{" "}
              <Link className="underline" href={`/spaces/${spaceId}/settings/codebase`}>Connect one</Link>.
            </Empty>
          )}
        </Card>

        <Card title="Running app">
          {app?.run_url ? (
            <div className="flex items-center gap-3 text-sm">
              <Status value={app.status} />
              <a className="underline" href={app.run_url} target="_blank" rel="noreferrer">{app.run_url}</a>
            </div>
          ) : (
            <Empty>
              No running app yet.{" "}
              <Link className="underline" href={`/spaces/${spaceId}#app`}>Add a URL</Link>.
            </Empty>
          )}
        </Card>

        <Card title="Components" action={<Link className="text-sm underline" href={`/spaces/${spaceId}/components`}>Open library</Link>}>
          {components.length === 0 ? (
            <Empty>No components registered for this space.</Empty>
          ) : (
            <ul className="text-sm">
              {components.slice(0, 6).map((component) => (
                <li key={component.id}>
                  <Link className="hover:underline" href={`/spaces/${spaceId}/components/${component.id}`}>
                    {component.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="truncate text-right">{value}</dd>
    </div>
  );
}