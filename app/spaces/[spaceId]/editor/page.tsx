import { getSpace } from "@/app/db";
import { notFound } from "next/navigation";

export default async function EditorPage(props: PageProps<"/spaces/[spaceId]/editor">) {
  const { spaceId } = await props.params;
  const space = await getSpace(spaceId);
  if (!space) notFound();

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-10 text-center">
      <h1 className="text-lg font-medium">Editor</h1>
      <p className="mt-2 text-sm text-neutral-500">
        The visual editor for <span className="font-medium text-neutral-700">{space.name}</span> is not built yet.
      </p>
    </div>
  );
}