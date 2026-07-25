begin;

revoke all on table public.extension_pairing_tokens from anon, authenticated;
revoke all on table public.extension_captures from anon, authenticated;

grant select, insert, delete on table public.extension_pairing_tokens to authenticated;
grant select, delete on table public.extension_captures to authenticated;

commit;