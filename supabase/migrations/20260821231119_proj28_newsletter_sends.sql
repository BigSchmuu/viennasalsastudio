-- PROJ-28: Newsletter-Versand mit Empfängergruppen
-- Append-only history of newsletter sends. Recipient lists themselves are
-- never stored — always computed live at send time (see PROJ-29/31/33 pattern).

CREATE TABLE newsletter_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  recipient_group TEXT NOT NULL CHECK (recipient_group = ANY (ARRAY['alle', 'aktive', 'probestunde_ohne_folgebuchung', 'kurs_teilnehmer'])),
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  recipient_count INTEGER NOT NULL,
  sent_by UUID NOT NULL REFERENCES auth.users(id),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE newsletter_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Newsletter sends: admin read" ON newsletter_sends
  FOR SELECT USING ("current_role"() = 'admin');

CREATE POLICY "Newsletter sends: admin insert" ON newsletter_sends
  FOR INSERT WITH CHECK ("current_role"() = 'admin');

CREATE INDEX idx_newsletter_sends_sent_at ON newsletter_sends (sent_at DESC);

-- New notification event group for newsletter sends (email-only channel,
-- enforced in application code, not the schema).
ALTER TABLE notification_queue DROP CONSTRAINT notification_queue_event_type_check;
ALTER TABLE notification_queue ADD CONSTRAINT notification_queue_event_type_check
  CHECK (event_type = ANY (ARRAY['buchungsstatus', 'warteliste', 'abo_kuendigung', 'kursstart_erinnerung', 'sepa_ankuendigung', 'event_tickets', 'probestunde_nachfassung', 'newsletter']));

ALTER TABLE notification_preferences DROP CONSTRAINT notification_preferences_event_group_check;
ALTER TABLE notification_preferences ADD CONSTRAINT notification_preferences_event_group_check
  CHECK (event_group = ANY (ARRAY['buchungsstatus', 'warteliste', 'abo_kuendigung', 'kursstart_erinnerung', 'event_tickets', 'probestunde_nachfassung', 'newsletter']));
