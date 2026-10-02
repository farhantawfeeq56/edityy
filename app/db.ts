import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export type Space = {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export async function listSpaces(): Promise<(Space & { component_count: number })[]> {
  const rows = await sql`
    select s.*, (
      select count(*)::int from components c where c.space_id = s.id
    ) as component_count
    from spaces s order by s.created_at desc`;
  return rows as (Space & { component_count: number })[];
}

export type Codebase = {
  space_id: string;
  repo_url: string;
  branch: string;
  root_dir: string;
  framework: string;
};

export type App = { space_id: string; run_url: string; status: string };

export type SpaceComponent = {
  id: string;
  space_id: string;
  name: string;
  description: string;
  file_path: string;
  updated_at: string;
};

export type Activity = {
  id: number;
  space_id: string | null;
  kind: string;
  summary: string;
  created_at: string;
};

export async function getSpace(id: string) {
  const [space] = await sql`select * from spaces where id = ${id}`;
  return space;
}

export async function getCodebase(spaceId: string) {
  const [row] = await sql`select * from codebases where space_id = ${spaceId}`;
  return row;
}

export async function getApp(spaceId: string) {
  const [row] = await sql`select * from apps where space_id = ${spaceId}`;
  return row;
}

export async function getSpaceComponentCount(spaceId: string) {
  const [row] = await sql`
    select count(*)::int as count from components where space_id = ${spaceId}`;
  return row?.count ?? 0;
}

export async function listActivity(limit = 10) {
  return sql`
    select a.*, s.name as space_name
    from activity a left join spaces s on s.id = a.space_id
    order by a.created_at desc limit ${limit}`;
}

export async function listComponents(spaceId: string) {
  return sql`select * from components where space_id = ${spaceId} order by name`;
}

export async function getComponent(id: string) {
  const [row] = await sql`select * from components where id = ${id}`;
  return row;
}

export async function listComponentUsage(componentId: string) {
  return sql`
    select page_path from component_usages where component_id = ${componentId} order by page_path`;
}