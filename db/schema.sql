create table if not exists spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists codebases (
  space_id uuid primary key references spaces (id) on delete cascade,
  repo_url text not null default '',
  branch text not null default '',
  root_dir text not null default '',
  framework text not null default ''
);

create table if not exists apps (
  space_id uuid primary key references spaces (id) on delete cascade,
  run_url text not null default '',
  status text not null default 'stopped'
);

create table if not exists components (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id) on delete cascade,
  name text not null,
  description text not null default '',
  file_path text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists component_usages (
  component_id uuid not null references components (id) on delete cascade,
  page_path text not null,
  primary key (component_id, page_path)
);

create table if not exists activity (
  id bigserial primary key,
  space_id uuid references spaces (id) on delete cascade,
  kind text not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists components_space_id_idx on components (space_id);
create index if not exists activity_created_at_idx on activity (created_at desc);