-- PROJ-29: Probestunden-Follow-up & Conversion-Tracking
-- Admin-only "kontaktiert" flag + note per trial booking. Conversion status
-- and "Follow-up überfällig" are pure derived computations (not stored here),
-- consistent with the pattern established in PROJ-31/PROJ-33.

CREATE TABLE trial_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES course_bookings(id) ON DELETE CASCADE,
  contacted BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE trial_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trial followups: admin read" ON trial_followups
  FOR SELECT USING ("current_role"() = 'admin');

CREATE POLICY "Trial followups: admin insert" ON trial_followups
  FOR INSERT WITH CHECK ("current_role"() = 'admin');

CREATE POLICY "Trial followups: admin update" ON trial_followups
  FOR UPDATE USING ("current_role"() = 'admin');

-- New notification event type/group for the two automated customer reminders.
ALTER TABLE notification_queue DROP CONSTRAINT notification_queue_event_type_check;
ALTER TABLE notification_queue ADD CONSTRAINT notification_queue_event_type_check
  CHECK (event_type = ANY (ARRAY['buchungsstatus', 'warteliste', 'abo_kuendigung', 'kursstart_erinnerung', 'sepa_ankuendigung', 'event_tickets', 'probestunde_nachfassung']));

ALTER TABLE notification_preferences DROP CONSTRAINT notification_preferences_event_group_check;
ALTER TABLE notification_preferences ADD CONSTRAINT notification_preferences_event_group_check
  CHECK (event_group = ANY (ARRAY['buchungsstatus', 'warteliste', 'abo_kuendigung', 'kursstart_erinnerung', 'event_tickets', 'probestunde_nachfassung']));
