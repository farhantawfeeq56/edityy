"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const str = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

async function logActivity(spaceId: string | null, kind: string, summary: string) {
  await sql`insert into activity (space_id, kind, summary) values (${spaceId}, ${kind}, ${summary})`;
}

export async function createSpace(form: FormData) {
  const name = str(form, "name");
  if (!name) redirect("/spaces?error=Name+is+required");

  const [space] = await sql`
    insert into spaces (name, description) values (${name}, ${str(form, "description")}) returning id`;
  await sql`insert into codebases (space_id) values (${space.id})`;
  await sql`insert into apps (space_id) values (${space.id})`;
  await logActivity(space.id, "space.created", `Created space ${name}`);

  redirect(`/spaces/${space.id}`);
}

export async function updateSpaceSettings(form: FormData) {
  const id = str(form, "space_id");
  const name = str(form, "name");
  if (!name) redirect(`/spaces/${id}/settings?error=Name+is+required`);

  await sql`
    update spaces set name = ${name}, description = ${str(form, "description")}, updated_at = now()
    where id = ${id}`;
  await logActivity(id, "space.updated", `Updated space ${name}`);

  revalidatePath(`/spaces/${id}/settings`);
}

export async function deleteSpace(form: FormData) {
  const id = str(form, "space_id");
  const name = str(form, "name") || "Space";
  await sql`delete from spaces where id = ${id}`;
  await logActivity(null, "space.deleted", `Deleted space ${name}`);

  redirect("/spaces");
}

export async function updateCodebase(form: FormData) {
  const id = str(form, "space_id");
  await sql`
    update codebases set
      repo_url = ${str(form, "repo_url")},
      branch = ${str(form, "branch")},
      root_dir = ${str(form, "root_dir")},
      framework = ${str(form, "framework")}
    where space_id = ${id}`;
  await logActivity(id, "codebase.updated", "Updated codebase connection");

  revalidatePath(`/spaces/${id}/settings/codebase`);
}

export async function updateApp(form: FormData) {
  const id = str(form, "space_id");
  const status = str(form, "status") || "stopped";
  await sql`update apps set run_url = ${str(form, "run_url")}, status = ${status} where space_id = ${id}`;
  await logActivity(id, "app.updated", `Set running app to ${status}`);

  revalidatePath(`/spaces/${id}`);
}

export async function saveComponent(form: FormData) {
  const spaceId = str(form, "space_id");
  const id = str(form, "id");
  const name = str(form, "name");
  if (!name) redirect(`/spaces/${spaceId}/components?error=Name+is+required`);

  const description = str(form, "description");
  const filePath = str(form, "file_path");

  if (id) {
    await sql`
      update components set name = ${name}, description = ${description},
        file_path = ${filePath}, updated_at = now()
      where id = ${id}`;
    await logActivity(spaceId, "component.updated", `Updated component ${name}`);
  } else {
    await sql`
      insert into components (space_id, name, description, file_path)
      values (${spaceId}, ${name}, ${description}, ${filePath})`;
    await logActivity(spaceId, "component.created", `Added component ${name}`);
  }

  redirect(`/spaces/${spaceId}/components`);
}

export async function deleteComponent(form: FormData) {
  const spaceId = str(form, "space_id");
  const id = str(form, "id");
  const [row] = await sql`select name from components where id = ${id}`;
  await sql`delete from components where id = ${id}`;
  if (row) await logActivity(spaceId, "component.deleted", `Removed component ${row.name}`);

  revalidatePath(`/spaces/${spaceId}/components`);
}

export async function setComponentUsage(form: FormData) {
  const spaceId = str(form, "space_id");
  const id = str(form, "id");
  await sql`delete from component_usages where component_id = ${id}`;
  for (const line of String(form.get("page_paths") ?? "").split("\n")) {
    const pagePath = line.trim();
    if (pagePath) {
      await sql`
        insert into component_usages (component_id, page_path) values (${id}, ${pagePath})
        on conflict do nothing`;
    }
  }
  await logActivity(spaceId, "component.updated", "Updated component usage");

  revalidatePath(`/spaces/${spaceId}/components/${id}`);
}