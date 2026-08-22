-- BUG-1 fix: allow role changes performed outside a normal end-user session
-- (i.e. auth.uid() is null — direct SQL / service_role / migrations, which
-- already fully bypass RLS and are trusted by definition). This unblocks
-- bootstrapping the first admin and assigning the teacher role, while still
-- blocking any authenticated non-admin end user from changing a role via
-- the REST API (their auth.uid() is never null).
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and public.current_role() is distinct from 'admin'
     and auth.uid() is not null then
    raise exception 'Only admins can change a user role';
  end if;
  return new;
end;
$$;

-- BUG-2 fix: current_role() must be callable by the anon role too, so RLS
-- policies that reference it resolve to a clean "no match" for anonymous
-- callers instead of a raw permission-denied SQL error. It only ever
-- returns the caller's own role (null for anon), so this leaks nothing.
grant execute on function public.current_role() to anon;
