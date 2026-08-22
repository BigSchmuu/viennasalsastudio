
create or replace function admin_list_customer_emails()
returns table (id uuid, email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if "current_role"() is distinct from 'admin' then
    raise exception 'access denied';
  end if;
  return query select au.id, au.email::text from auth.users au;
end;
$$;
