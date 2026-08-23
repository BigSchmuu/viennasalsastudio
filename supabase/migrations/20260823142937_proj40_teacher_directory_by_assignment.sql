-- PROJ-40: public teacher visibility now follows the course assignment, not
-- the internal role.
--
-- Before, this view filtered on role = 'teacher'. That tied a public statement
-- ("who teaches this course") to an internal permission, so promoting someone
-- to admin would silently remove them from the course cards while they carried
-- on teaching.
--
-- Two things fall out of the new rule without any extra handling:
--   * Admins who teach appear, exactly like any other teacher.
--   * The leftover technical admin accounts never appear — not because they are
--     filtered out, but because they teach nothing. No exclusion list to
--     maintain, and none to go stale.
--
-- The role check stays as a safety net: even if a stray assignment ever pointed
-- at a customer, their name would not become public.
--
-- security_invoker=false is kept from the original definition — the view is
-- read by anonymous visitors on the public course pages.
create or replace view public.teacher_directory
with (security_invoker = false) as
  select p.id, p.full_name
  from public.profiles p
  where p.role in ('teacher', 'admin')
    and exists (
      select 1 from public.course_teachers ct where ct.teacher_id = p.id
    );
