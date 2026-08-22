
-- Subscriptions: manual admin-managed name/price (status constraint already exists from PROJ-1)
alter table subscriptions add column name text;
alter table subscriptions add column price numeric(10,2);

-- Narrow, admin-only email lookup (profiles has no email column; auth.users
-- must stay locked down, so this exposes only id+email, nothing else).
create function admin_list_customer_emails()
returns table (id uuid, email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if "current_role"() != 'admin' then
    raise exception 'access denied';
  end if;
  return query select au.id, au.email::text from auth.users au;
end;
$$;

revoke all on function admin_list_customer_emails() from public;
grant execute on function admin_list_customer_emails() to authenticated;
