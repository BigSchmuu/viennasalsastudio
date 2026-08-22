
-- Supabase grants broad default privileges (INSERT/UPDATE/DELETE/TRUNCATE/...)
-- to anon/authenticated on new relations in public by default, since RLS is
-- normally the sole gatekeeper. This view intentionally bypasses profiles'
-- RLS to expose teacher names, so those default write privileges must be
-- revoked explicitly — otherwise anon/authenticated could write to profiles
-- through the view (blocked only by incidental constraints, not by design).
revoke all on teacher_directory from anon, authenticated;
grant select on teacher_directory to anon, authenticated;
