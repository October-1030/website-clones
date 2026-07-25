begin;

revoke execute on function public.ingest_extension_capture(text, uuid, text, text, text, timestamptz, jsonb) from authenticated;
grant execute on function public.ingest_extension_capture(text, uuid, text, text, text, timestamptz, jsonb) to anon;

commit;