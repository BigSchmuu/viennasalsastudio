create policy "VideoSetLessons: enrolled customer read"
on video_set_lessons
for select
to public
using (
  exists (
    select 1
    from courses c
    join subscriptions s on (s.course_id = c.id or s.course_id is null)
    where c.video_set_id = video_set_lessons.video_set_id
      and s.customer_id = (select auth.uid())
      and s.status = 'active'
  )
);
