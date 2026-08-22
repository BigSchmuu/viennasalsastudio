-- Wrap auth.uid() in a subselect so it's evaluated once per statement
-- instead of once per row (Supabase RLS performance best practice).

-- profiles
drop policy "Profiles: select own or admin" on public.profiles;
create policy "Profiles: select own or admin" on public.profiles
  for select using ((select auth.uid()) = id or public.current_role() = 'admin');

drop policy "Profiles: update own or admin" on public.profiles;
create policy "Profiles: update own or admin" on public.profiles
  for update using ((select auth.uid()) = id or public.current_role() = 'admin');

-- course_materials
drop policy "CourseMaterials: assigned teacher or admin read" on public.course_materials;
create policy "CourseMaterials: assigned teacher or admin read" on public.course_materials
  for select using (
    public.current_role() = 'admin'
    or exists (
      select 1 from public.course_teachers ct
      where ct.course_id = course_materials.course_id
        and ct.teacher_id = (select auth.uid())
    )
  );

-- bookings
drop policy "Bookings: own or admin read" on public.bookings;
create policy "Bookings: own or admin read" on public.bookings
  for select using ((select auth.uid()) = customer_id or public.current_role() = 'admin');

drop policy "Bookings: own insert" on public.bookings;
create policy "Bookings: own insert" on public.bookings
  for insert with check ((select auth.uid()) = customer_id or public.current_role() = 'admin');

drop policy "Bookings: own or admin update" on public.bookings;
create policy "Bookings: own or admin update" on public.bookings
  for update using ((select auth.uid()) = customer_id or public.current_role() = 'admin');

drop policy "Bookings: own or admin delete" on public.bookings;
create policy "Bookings: own or admin delete" on public.bookings
  for delete using ((select auth.uid()) = customer_id or public.current_role() = 'admin');

-- subscriptions
drop policy "Subscriptions: own or admin read" on public.subscriptions;
create policy "Subscriptions: own or admin read" on public.subscriptions
  for select using ((select auth.uid()) = customer_id or public.current_role() = 'admin');
