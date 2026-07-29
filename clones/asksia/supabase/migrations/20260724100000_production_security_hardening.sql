begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Users may personalize their own profile, but plan assignment remains server-managed.
revoke update on table public.profiles from authenticated;
grant update (display_name, preferences) on table public.profiles to authenticated;

alter table public.profiles
  add constraint profiles_preferences_size_check
  check (octet_length(preferences::text) <= 16384) not valid;
alter table public.profiles validate constraint profiles_preferences_size_check;

alter table public.learning_sessions
  add constraint learning_sessions_payload_size_check
  check (octet_length(payload::text) <= 2097152) not valid;
alter table public.learning_sessions validate constraint learning_sessions_payload_size_check;

alter table public.learning_artifacts
  add constraint learning_artifacts_payload_size_check
  check (octet_length(payload::text) <= 1048576) not valid;
alter table public.learning_artifacts validate constraint learning_artifacts_payload_size_check;

-- Serialize each user's inserts so concurrent requests cannot bypass row caps.
create or replace function public.enforce_studypal_row_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  existing_count bigint;
  maximum_rows integer;
begin
  if current_user_id is not null and new.user_id <> current_user_id then
    raise exception 'StudyPal row owner does not match the authenticated user.'
      using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text || ':' || tg_table_name, 74417)
  );

  case tg_table_name
    when 'learning_sessions' then
      select count(*) into existing_count
      from public.learning_sessions
      where user_id = new.user_id;
      maximum_rows := 500;
    when 'learning_artifacts' then
      select count(*) into existing_count
      from public.learning_artifacts
      where user_id = new.user_id;
      maximum_rows := 1000;
    when 'extension_pairing_tokens' then
      select count(*) into existing_count
      from public.extension_pairing_tokens
      where user_id = new.user_id;
      maximum_rows := 20;
    when 'extension_captures' then
      select count(*) into existing_count
      from public.extension_captures
      where user_id = new.user_id;
      maximum_rows := 500;
    when 'lms_connections' then
      select count(*) into existing_count
      from public.lms_connections
      where user_id = new.user_id;
      maximum_rows := 20;
    else
      raise exception 'Unsupported StudyPal row-limit table.'
        using errcode = '22023';
  end case;

  if existing_count >= maximum_rows then
    raise exception 'StudyPal row limit reached for %.', tg_table_name
      using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_studypal_row_limit() from public, anon, authenticated;

create trigger learning_sessions_row_limit
before insert on public.learning_sessions
for each row execute function public.enforce_studypal_row_limit();

create trigger learning_artifacts_row_limit
before insert on public.learning_artifacts
for each row execute function public.enforce_studypal_row_limit();

create trigger extension_pairing_tokens_row_limit
before insert on public.extension_pairing_tokens
for each row execute function public.enforce_studypal_row_limit();

create trigger extension_captures_row_limit
before insert on public.extension_captures
for each row execute function public.enforce_studypal_row_limit();

create trigger lms_connections_row_limit
before insert on public.lms_connections
for each row execute function public.enforce_studypal_row_limit();

-- Bind every LMS child to a parent owned by the same user. RLS remains defense-in-depth.
alter table public.lms_connections
  add constraint lms_connections_id_user_unique unique (id, user_id);

alter table public.lms_courses
  add constraint lms_courses_id_user_connection_unique unique (id, user_id, connection_id);

alter table public.lms_courses
  add constraint lms_courses_owner_connection_fk
  foreign key (connection_id, user_id)
  references public.lms_connections (id, user_id)
  on delete cascade
  not valid;
alter table public.lms_courses validate constraint lms_courses_owner_connection_fk;

alter table public.lms_materials
  add constraint lms_materials_owner_connection_fk
  foreign key (connection_id, user_id)
  references public.lms_connections (id, user_id)
  on delete cascade
  not valid;
alter table public.lms_materials validate constraint lms_materials_owner_connection_fk;

alter table public.lms_materials
  add constraint lms_materials_owner_course_fk
  foreign key (course_id, user_id, connection_id)
  references public.lms_courses (id, user_id, connection_id)
  on delete cascade
  not valid;
alter table public.lms_materials validate constraint lms_materials_owner_course_fk;

alter table public.lms_sync_runs
  add constraint lms_sync_runs_owner_connection_fk
  foreign key (connection_id, user_id)
  references public.lms_connections (id, user_id)
  on delete cascade
  not valid;
alter table public.lms_sync_runs validate constraint lms_sync_runs_owner_connection_fk;

commit;
