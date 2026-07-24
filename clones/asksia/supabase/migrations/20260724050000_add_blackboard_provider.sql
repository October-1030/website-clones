begin;

alter table public.lms_connections
  drop constraint lms_connections_provider_check;

alter table public.lms_connections
  add constraint lms_connections_provider_check
  check (provider in ('canvas', 'blackboard'));

commit;
