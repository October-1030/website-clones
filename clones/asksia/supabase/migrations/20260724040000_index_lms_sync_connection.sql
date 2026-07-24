begin;

create index lms_sync_runs_connection_idx
  on public.lms_sync_runs (connection_id);

commit;
