-- PROJ-44 Sicherheitsluecke: Die drei Empfehlungsspalten waren fuer den
-- Kunden selbst beschreibbar.
--
-- Was der Angriff konnte, nachgewiesen und nicht vermutet:
-- referral_rewarded_at auf null setzen, woraufhin der naechste
-- Lastschriftlauf dieselbe Empfehlung erneut belohnt haette -- Monat fuer
-- Monat, je 15 EUR fuer zwei Konten. Ausserdem referred_by selbst eintragen,
-- was die Bedingung "nur fuer Neukunden" umgeht, und den eigenen Code frei
-- waehlen.
--
-- Ein spaltenweiser Entzug blieb wirkungslos, weil das Update-Recht auf
-- Tabellenebene vergeben war. Richtig ist: das Tabellenrecht entziehen und
-- genau die Spalten zurueckgeben, die vorher schon beschreibbar waren.
--
-- Geschrieben werden die drei Spalten ausschliesslich von
-- create_regular_course_booking, grant_pending_referral_rewards und dem
-- Trigger beim Anlegen. Alle laufen als security definer und sind davon nicht
-- betroffen.
--
-- role bleibt beschreibbar: Der Betreiber aendert Rollen ueber dieselbe
-- Datenbankrolle wie jeder Kunde, und eine eigenmaechtige Erhoehung weist
-- bereits ein Trigger ab ("Only admins can change a user role") -- geprueft.
revoke update on public.profiles from authenticated, anon;

grant update (id, full_name, role, phone, birthdate, gender, created_at, referral_source, language)
  on public.profiles to authenticated, anon;
