begin;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Student'
    check (char_length(display_name) between 1 and 40),
  preferences jsonb not null default '{"preferredLanguage":"auto","tone":"clear","learningStyles":["step-by-step"],"memoryEnabled":true}'::jsonb
    check (jsonb_typeof(preferences) = 'object'),
  plan text not null default 'free'
    check (plan in ('free', 'pro', 'education')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null
    check (client_id ~ '^[a-zA-Z0-9_-]{1,100}$'),
  kind text not null
    check (kind in ('study', 'homework', 'video', 'transcribe')),
  title text not null
    check (char_length(title) between 1 and 300),
  subtitle text not null default ''
    check (char_length(subtitle) <= 500),
  provider_label text not null default ''
    check (char_length(provider_label) <= 200),
  payload jsonb not null
    check (jsonb_typeof(payload) = 'object'),
  schema_version smallint not null default 1
    check (schema_version between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind, client_id)
);

create table if not exists public.learning_artifacts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null
    check (client_id ~ '^[a-zA-Z0-9_-]{1,100}$'),
  kind text not null
    check (kind in ('quiz', 'study-guide', 'flashcard', 'essay', 'detector')),
  source_client_id text,
  payload jsonb not null
    check (jsonb_typeof(payload) = 'object'),
  schema_version smallint not null default 1
    check (schema_version between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind, client_id)
);

create index if not exists learning_sessions_user_updated_idx
  on public.learning_sessions (user_id, updated_at desc);
create index if not exists learning_sessions_user_kind_updated_idx
  on public.learning_sessions (user_id, kind, updated_at desc);
create index if not exists learning_artifacts_user_updated_idx
  on public.learning_artifacts (user_id, updated_at desc);
create index if not exists learning_artifacts_source_idx
  on public.learning_artifacts (user_id, source_client_id)
  where source_client_id is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists learning_sessions_set_updated_at on public.learning_sessions;
create trigger learning_sessions_set_updated_at
before update on public.learning_sessions
for each row execute function public.set_updated_at();

drop trigger if exists learning_artifacts_set_updated_at on public.learning_artifacts;
create trigger learning_artifacts_set_updated_at
before update on public.learning_artifacts
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Student'), 40)
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.learning_sessions enable row level security;
alter table public.learning_sessions force row level security;
alter table public.learning_artifacts enable row level security;
alter table public.learning_artifacts force row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists sessions_select_own on public.learning_sessions;
create policy sessions_select_own on public.learning_sessions
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists sessions_insert_own on public.learning_sessions;
create policy sessions_insert_own on public.learning_sessions
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists sessions_update_own on public.learning_sessions;
create policy sessions_update_own on public.learning_sessions
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists sessions_delete_own on public.learning_sessions;
create policy sessions_delete_own on public.learning_sessions
for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists artifacts_select_own on public.learning_artifacts;
create policy artifacts_select_own on public.learning_artifacts
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists artifacts_insert_own on public.learning_artifacts;
create policy artifacts_insert_own on public.learning_artifacts
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists artifacts_update_own on public.learning_artifacts;
create policy artifacts_update_own on public.learning_artifacts
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists artifacts_delete_own on public.learning_artifacts;
create policy artifacts_delete_own on public.learning_artifacts
for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.profiles from anon;
revoke all on public.learning_sessions from anon;
revoke all on public.learning_artifacts from anon;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.learning_sessions to authenticated;
grant select, insert, update, delete on public.learning_artifacts to authenticated;
grant usage, select on sequence public.learning_sessions_id_seq to authenticated;
grant usage, select on sequence public.learning_artifacts_id_seq to authenticated;

commit;
