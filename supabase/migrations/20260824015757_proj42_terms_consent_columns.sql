-- PROJ-42: Wann zugestimmt wurde und welcher Stand der AGB dabei galt.
--
-- Nullable, und das ist Absicht: Vorgaenge von vor der Einfuehrung haben keine
-- Zustimmung. Sie leer zu lassen ist ehrlich; ein nachtraeglich erfundener
-- Zeitpunkt waere ein falscher Nachweis und damit schlechter als gar keiner.
alter table public.course_bookings
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text;

alter table public.waitlist_entries
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text;

alter table public.tickets
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text;

-- Entweder beides oder nichts. Ein Zeitpunkt ohne Fassung sagt nicht, wozu
-- zugestimmt wurde; eine Fassung ohne Zeitpunkt nicht, ob ueberhaupt.
alter table public.course_bookings
  add constraint course_bookings_terms_complete
  check ((terms_accepted_at is null) = (terms_version is null));

alter table public.waitlist_entries
  add constraint waitlist_entries_terms_complete
  check ((terms_accepted_at is null) = (terms_version is null));

alter table public.tickets
  add constraint tickets_terms_complete
  check ((terms_accepted_at is null) = (terms_version is null));

comment on column public.course_bookings.terms_accepted_at is
  'PROJ-42: Zeitpunkt der AGB-Zustimmung. NULL = Buchung stammt von vor der Einfuehrung.';
comment on column public.course_bookings.terms_version is
  'PROJ-42: Stand der AGB zum Zeitpunkt der Zustimmung, z.B. 2026-08. Kommt aus AGB_VERSION in src/lib/legal.ts.';
