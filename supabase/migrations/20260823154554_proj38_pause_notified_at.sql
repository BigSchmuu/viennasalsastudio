-- PROJ-38: when the customers affected by this cancelled session were last told.
--
-- Deliberately just a timestamp, not a recipient list: who is affected is
-- worked out at send time. A stored list would go stale the moment somebody
-- cancels their subscription or signs up, and would then either message the
-- wrong people or skip the right ones.
--
-- Null means "entering the pause did not notify anybody" — holidays are entered
-- months ahead and must not trigger messages on their own.
alter table public.course_schedule_pauses
  add column if not exists notified_at timestamptz;

comment on column public.course_schedule_pauses.notified_at is
  'PROJ-38: last time affected customers were notified about this cancelled '
  'session. Null = never notified. Repeat sends are allowed and overwrite it.';
