begin;

create table public.account_usage_periods (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  plan_id text not null default 'free' check (plan_id = 'free'),
  ai_requests_used integer not null default 0 check (ai_requests_used >= 0),
  file_pages_used integer not null default 0 check (file_pages_used >= 0),
  recording_seconds_used integer not null default 0 check (recording_seconds_used >= 0),
  ai_detection_chars_used integer not null default 0 check (ai_detection_chars_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, period_start),
  check (period_start = date_trunc('month', period_start::timestamp)::date)
);

alter table public.account_usage_periods enable row level security;
alter table public.account_usage_periods force row level security;

create policy account_usage_select_own on public.account_usage_periods
for select to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.account_usage_periods from anon, authenticated;
grant select on table public.account_usage_periods to authenticated;

create or replace function public.consume_account_usage(p_changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_period_start date := date_trunc('month', timezone('utc', now()))::date;
  v_ai integer := 0;
  v_pages integer := 0;
  v_recording integer := 0;
  v_detection integer := 0;
  v_row public.account_usage_periods%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if p_changes is null
    or jsonb_typeof(p_changes) <> 'object'
    or p_changes = '{}'::jsonb
    or exists (
      select 1 from jsonb_object_keys(p_changes) as key
      where key not in ('ai_requests', 'file_pages', 'recording_seconds', 'ai_detection_chars')
    )
    or exists (
      select 1 from jsonb_each(p_changes) as entry
      where jsonb_typeof(entry.value) <> 'number'
        or entry.value::text !~ '^[0-9]+$'
        or length(entry.value::text) > 10
        or (entry.value::text)::numeric <= 0
        or (entry.key = 'ai_requests' and (entry.value::text)::numeric > 10)
        or (entry.key = 'file_pages' and (entry.value::text)::numeric > 500)
        or (entry.key = 'recording_seconds' and (entry.value::text)::numeric > 605)
        or (entry.key = 'ai_detection_chars' and (entry.value::text)::numeric > 10000)
    )
  then
    raise exception 'invalid usage changes' using errcode = '23514';
  end if;

  v_ai := coalesce((p_changes ->> 'ai_requests')::integer, 0);
  v_pages := coalesce((p_changes ->> 'file_pages')::integer, 0);
  v_recording := coalesce((p_changes ->> 'recording_seconds')::integer, 0);
  v_detection := coalesce((p_changes ->> 'ai_detection_chars')::integer, 0);

  insert into public.account_usage_periods (user_id, period_start)
  values (v_user_id, v_period_start)
  on conflict (user_id, period_start) do nothing;

  select * into v_row
  from public.account_usage_periods as usage
  where usage.user_id = v_user_id and usage.period_start = v_period_start
  for update;

  if v_row.ai_requests_used + v_ai > 10 then
    raise exception 'usage quota exceeded' using errcode = 'P0001', detail = 'ai_requests';
  end if;
  if v_row.file_pages_used + v_pages > 100 then
    raise exception 'usage quota exceeded' using errcode = 'P0001', detail = 'file_pages';
  end if;
  if v_row.recording_seconds_used + v_recording > 600 then
    raise exception 'usage quota exceeded' using errcode = 'P0001', detail = 'recording_seconds';
  end if;
  if v_row.ai_detection_chars_used + v_detection > 10000 then
    raise exception 'usage quota exceeded' using errcode = 'P0001', detail = 'ai_detection_chars';
  end if;

  update public.account_usage_periods as usage
  set ai_requests_used = usage.ai_requests_used + v_ai,
      file_pages_used = usage.file_pages_used + v_pages,
      recording_seconds_used = usage.recording_seconds_used + v_recording,
      ai_detection_chars_used = usage.ai_detection_chars_used + v_detection,
      updated_at = now()
  where usage.user_id = v_user_id and usage.period_start = v_period_start
  returning * into v_row;

  return jsonb_build_object(
    'plan_id', v_row.plan_id,
    'period_start', v_row.period_start,
    'period_end', (v_row.period_start + interval '1 month')::date,
    'ai_requests_used', v_row.ai_requests_used,
    'file_pages_used', v_row.file_pages_used,
    'recording_seconds_used', v_row.recording_seconds_used,
    'ai_detection_chars_used', v_row.ai_detection_chars_used
  );
end;
$$;

revoke all on function public.consume_account_usage(jsonb) from public, anon, authenticated;
grant execute on function public.consume_account_usage(jsonb) to authenticated;

commit;