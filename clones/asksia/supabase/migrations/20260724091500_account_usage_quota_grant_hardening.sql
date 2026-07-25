begin;

-- Supabase may materialize default function grants for API roles. Revoke them
-- explicitly before restoring the one role this authenticated RPC requires.
revoke all on function public.consume_account_usage(jsonb) from public, anon, authenticated;
grant execute on function public.consume_account_usage(jsonb) to authenticated;

commit;