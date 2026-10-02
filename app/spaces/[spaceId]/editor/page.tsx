import { getSpace } from "@/app/db";
import { Pending } from "@/app/ui";
import { notFound } from "next/navigation";

export default async function EditorPage(props: PageProps<"/spaces/[spaceId]/editor">) {
  const { spaceId } = await props.params;
  const space = await getSpace(spaceId);
  if (!space) notFound();

  return (
    <Pending title="Editor">
      The visual editor for <span className="font-medium text-neutral-900">{space.name}</span> is not built yet.
    </Pending>
  );
}