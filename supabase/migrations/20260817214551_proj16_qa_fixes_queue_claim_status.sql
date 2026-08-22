-- BUG-4 fix: add a "processing" status so rows can be atomically claimed before
-- being sent, preventing the same row from being processed twice by a racing
-- inline dispatch and the cron drain.
alter table public.notification_queue drop constraint notification_queue_status_check;
alter table public.notification_queue add constraint notification_queue_status_check
  check (status in ('pending', 'processing', 'processed'));
