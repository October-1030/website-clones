begin;

create table public.lms_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('canvas')),
  instance_url text not null
    check (char_length(instance_url) between 12 and 500 and instance_url ~ '^https://'),
  account_label text not null default 'Canvas'
    check (char_length(account_label) between 1 and 120),
  access_token_ciphertext text not null
    check (char_length(access_token_ciphertext) between 40 and 12000),
  refresh_token_ciphertext text
    check (refresh_token_ciphertext is null or char_length(refresh_token_ciphertext) between 40 and 12000),
  token_expires_at timestamptz,
  scopes text[] not null default '{}'::text[],
  status text not null default 'connected'
    check (status in ('connected', 'expired', 'error')),
  last_synced_at timestamptz,
  last_error text
    check (last_error is null or char_length(last_error) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, instance_url)
);

create table public.lms_courses (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.lms_connections(id) on delete cascade,
  external_id text not null check (char_length(external_id) between 1 and 200),
  name text not null check (char_length(name) between 1 and 300),
  course_code text not null default '' check (char_length(course_code) <= 120),
  enrollment_state text not null default '' check (char_length(enrollment_state) <= 80),
  workflow_state text not null default '' check (char_length(workflow_state) <= 80),
  start_at timestamptz,
  end_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, external_id)
);

create table public.lms_materials (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.lms_connections(id) on delete cascade,
  course_id bigint not null references public.lms_courses(id) on delete cascade,
  external_id text not null check (char_length(external_id) between 1 and 300),
  kind text not null
    check (kind in ('module', 'page', 'file', 'assignment', 'external-link')),
  title text not null check (char_length(title) between 1 and 500),
  module_name text not null default '' check (char_length(module_name) <= 300),
  source_url text check (source_url is null or char_length(source_url) <= 2000),
  mime_type text check (mime_type is null or char_length(mime_type) <= 200),
  due_at timestamptz,
  position integer not null default 0 check (position between 0 and 1000000),
  text_content text not null default '' check (char_length(text_content) <= 200000),
  content_hash text not null default '' check (char_length(content_hash) <= 128),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, kind, external_id)
);

create table public.lms_sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.lms_connections(id) on delete cascade,
  status text not null check (status in ('running', 'completed', 'failed')),
  courses_synced integer not null default 0 check (courses_synced >= 0),
  materials_synced integer not null default 0 check (materials_synced >= 0),
  error_code text check (error_code is null or char_length(error_code) <= 100),
  error_message text check (error_message is null or char_length(error_message) <= 1000),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index lms_connections_user_updated_idx
  on public.lms_connections (user_id, updated_at desc);
create index lms_courses_user_connection_idx
  on public.lms_courses (user_id, connection_id, updated_at desc);
create index lms_materials_user_course_idx
  on public.lms_materials (user_id, course_id, kind, position);
create index lms_materials_connection_updated_idx
  on public.lms_materials (connection_id, updated_at desc);
create index lms_sync_runs_user_connection_idx
  on public.lms_sync_runs (user_id, connection_id, started_at desc);

create trigger lms_connections_set_updated_at
before update on public.lms_connections
for each row execute function public.set_updated_at();

create trigger lms_courses_set_updated_at
before update on public.lms_courses
for each row execute function public.set_updated_at();

create trigger lms_materials_set_updated_at
before update on public.lms_materials
for each row execute function public.set_updated_at();

alter table public.lms_connections enable row level security;
alter table public.lms_connections force row level security;
alter table public.lms_courses enable row level security;
alter table public.lms_courses force row level security;
alter table public.lms_materials enable row level security;
alter table public.lms_materials force row level security;
alter table public.lms_sync_runs enable row level security;
alter table public.lms_sync_runs force row level security;

create policy lms_connections_select_own on public.lms_connections
for select to authenticated using ((select auth.uid()) = user_id);
create policy lms_connections_insert_own on public.lms_connections
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy lms_connections_update_own on public.lms_connections
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy lms_connections_delete_own on public.lms_connections
for delete to authenticated using ((select auth.uid()) = user_id);

create policy lms_courses_select_own on public.lms_courses
for select to authenticated using ((select auth.uid()) = user_id);
create policy lms_courses_insert_own on public.lms_courses
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy lms_courses_update_own on public.lms_courses
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy lms_courses_delete_own on public.lms_courses
for delete to authenticated using ((select auth.uid()) = user_id);

create policy lms_materials_select_own on public.lms_materials
for select to authenticated using ((select auth.uid()) = user_id);
create policy lms_materials_insert_own on public.lms_materials
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy lms_materials_update_own on public.lms_materials
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy lms_materials_delete_own on public.lms_materials
for delete to authenticated using ((select auth.uid()) = user_id);

create policy lms_sync_runs_select_own on public.lms_sync_runs
for select to authenticated using ((select auth.uid()) = user_id);
create policy lms_sync_runs_insert_own on public.lms_sync_runs
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy lms_sync_runs_update_own on public.lms_sync_runs
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on public.lms_connections from anon;
revoke all on public.lms_courses from anon;
revoke all on public.lms_materials from anon;
revoke all on public.lms_sync_runs from anon;

grant select, insert, update, delete on public.lms_connections to authenticated;
grant select, insert, update, delete on public.lms_courses to authenticated;
grant select, insert, update, delete on public.lms_materials to authenticated;
grant select, insert, update on public.lms_sync_runs to authenticated;
grant usage, select on sequence public.lms_courses_id_seq to authenticated;
grant usage, select on sequence public.lms_materials_id_seq to authenticated;

commit;
