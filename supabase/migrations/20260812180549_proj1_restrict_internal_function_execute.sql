-- Internal helper/trigger functions should not be directly callable via the
-- PostgREST RPC API. Trigger firing is unaffected by these revokes.

revoke execute on function public.current_role() from public, anon, authenticated;
grant execute on function public.current_role() to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.prevent_role_self_escalation() from public, anon, authenticated;
