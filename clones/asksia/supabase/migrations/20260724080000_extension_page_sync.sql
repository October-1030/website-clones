begin;

create table public.extension_pairing_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Chrome on this computer'
    check (char_length(label) between 1 and 80),
  token_hash text not null unique
    check (token_hash ~ '^[0-9a-f]{64}$'),
  token_hint text not null
    check (char_length(token_hint) between 12 and 24),
  expires_at timestamptz not null,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.extension_captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_id uuid references public.extension_pairing_tokens(id) on delete set null,
  client_capture_id uuid not null,
  source_url text not null
    check (char_length(source_url) between 8 and 2048 and source_url ~ '^https?://'),
  title text not null
    check (char_length(title) between 1 and 500),
  text_content text not null
    check (char_length(text_content) between 50 and 120000),
  captured_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 16384),
  created_at timestamptz not null default now(),
  unique (user_id, client_capture_id)
);

create index extension_pairing_tokens_user_created_idx
  on public.extension_pairing_tokens (user_id, created_at desc);
create index extension_captures_user_captured_idx
  on public.extension_captures (user_id, captured_at desc);
create index extension_captures_token_created_idx
  on public.extension_captures (token_id, created_at desc)
  where token_id is not null;

alter table public.extension_pairing_tokens enable row level security;
alter table public.extension_pairing_tokens force row level security;
alter table public.extension_captures enable row level security;
alter table public.extension_captures force row level security;

create policy extension_tokens_select_own on public.extension_pairing_tokens
for select to authenticated using ((select auth.uid()) = user_id);
create policy extension_tokens_insert_own on public.extension_pairing_tokens
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy extension_tokens_delete_own on public.extension_pairing_tokens
for delete to authenticated using ((select auth.uid()) = user_id);

create policy extension_captures_select_own on public.extension_captures
for select to authenticated using ((select auth.uid()) = user_id);
create policy extension_captures_delete_own on public.extension_captures
for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.extension_pairing_tokens from anon, authenticated;
revoke all on table public.extension_captures from anon, authenticated;
grant select, insert, delete on public.extension_pairing_tokens to authenticated;
grant select, delete on public.extension_captures to authenticated;

create or replace function public.ingest_extension_capture(
  p_token_hash text,
  p_client_capture_id uuid,
  p_source_url text,
  p_title text,
  p_text_content text,
  p_captured_at timestamptz,
  p_metadata jsonb
)
returns table (capture_id uuid, deduplicated boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token_id uuid;
  v_user_id uuid;
  v_capture_id uuid;
  v_deduplicated boolean := false;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid extension token' using errcode = '28000';
  end if;

  select id, user_id
    into v_token_id, v_user_id
  from public.extension_pairing_tokens
  where token_hash = p_token_hash
    and expires_at > now()
  for update;

  if not found then
    raise exception 'invalid extension token' using errcode = '28000';
  end if;

  if p_client_capture_id is null
    or p_source_url is null
    or char_length(p_source_url) not between 8 and 2048
    or p_source_url !~ '^https?://'
    or p_title is null
    or char_length(p_title) not between 1 and 500
    or p_text_content is null
    or char_length(p_text_content) not between 50 and 120000
    or p_captured_at is null
    or p_captured_at < now() - interval '7 days'
    or p_captured_at > now() + interval '5 minutes'
    or p_metadata is null
    or jsonb_typeof(p_metadata) <> 'object'
    or octet_length(p_metadata::text) > 16384
  then
    raise exception 'invalid extension capture' using errcode = '23514';
  end if;

  select id
    into v_capture_id
  from public.extension_captures
  where user_id = v_user_id
    and client_capture_id = p_client_capture_id;

  if found then
    update public.extension_pairing_tokens
      set last_used_at = now()
    where id = v_token_id;
    return query select v_capture_id, true;
    return;
  end if;

  if (
    select count(*)
    from public.extension_captures
    where token_id = v_token_id
      and created_at > now() - interval '1 minute'
  ) >= 20 then
    raise exception 'extension rate limit exceeded' using errcode = 'P0001';
  end if;

  insert into public.extension_captures (
    user_id,
    token_id,
    client_capture_id,
    source_url,
    title,
    text_content,
    captured_at,
    metadata
  ) values (
    v_user_id,
    v_token_id,
    p_client_capture_id,
    p_source_url,
    p_title,
    p_text_content,
    p_captured_at,
    p_metadata
  )
  on conflict (user_id, client_capture_id) do nothing
  returning id into v_capture_id;

  if v_capture_id is null then
    select id
      into v_capture_id
    from public.extension_captures
    where user_id = v_user_id
      and client_capture_id = p_client_capture_id;
    v_deduplicated := true;
  end if;

  update public.extension_pairing_tokens
    set last_used_at = now()
  where id = v_token_id;

  return query select v_capture_id, v_deduplicated;
end;
$$;

revoke all on function public.ingest_extension_capture(text, uuid, text, text, text, timestamptz, jsonb) from public;
grant execute on function public.ingest_extension_capture(text, uuid, text, text, text, timestamptz, jsonb) to anon;

commit;
