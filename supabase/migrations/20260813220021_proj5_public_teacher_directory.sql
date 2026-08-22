
-- Narrow public view exposing only teacher id+name for the course catalog.
-- Owned by the migration role (bypasses profiles' RLS), so this is the ONLY
-- way teacher names become publicly visible — no change to profiles' own
-- RLS policies, customer data stays fully private.
create view teacher_directory as
  select id, full_name from profiles where role = 'teacher';

grant select on teacher_directory to anon, authenticated;
