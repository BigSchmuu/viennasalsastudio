-- PROJ-7: Beweiskraft und Auffälligkeiten beim SEPA-Mandat.
--
-- Beim Lastschriftverfahren kann der Zahlungsempfänger nicht prüfen, wem eine
-- IBAN gehört — das Mandat *ist* die Erklärung, es ersetzt die Prüfung. Ein
-- Kunde kann also eine fremde IBAN eintragen, und technisch merkt das niemand.
-- Was bleibt, ist zweierlei: den Vorgang beweisbar machen und Auffälligkeiten
-- sichtbar.
--
-- 1. Beweiskraft. Bisher standen am Mandat nur Referenz und Zeitpunkt. Bei
--    einer Rückbuchung mit der Begründung „nie erteilt" ist das der
--    Unterschied zwischen „wir haben nichts" und „erteilt am 11.09. um 14:22
--    von dieser Adresse".
--
--    Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO — die Verteidigung gegen eine
--    unberechtigte Rückbuchung ist ein berechtigtes Interesse. Die Angaben
--    gehören in die Datenschutzerklärung, und sie sind bewusst sparsam: die
--    Adresse und die Browserkennung, nicht mehr.
alter table public.sepa_mandates
  add column if not exists consent_ip text,
  add column if not exists consent_user_agent text;

comment on column public.sepa_mandates.consent_ip is
  'PROJ-7: Adresse, von der die Mandatserteilung kam. Nur zur Verteidigung gegen unberechtigte Rückbuchungen (Art. 6 Abs. 1 lit. f DSGVO).';

-- 2. Der Name auf dem Konto, wie er beim Erteilen vom Profilnamen abwich.
--
--    Eine Abweichung ist nicht verdächtig — Eltern zahlen fürs Kind, Partner
--    teilen ein Konto. Sie ist aber der einzige Anhaltspunkt, den es
--    überhaupt gibt, und der Kunde bestätigt sie beim Erteilen ausdrücklich.
--    Festgehalten wird der Profilname von damals: Der heutige sagt nichts
--    darüber, was der Kunde bei der Zustimmung vor Augen hatte.
alter table public.sepa_mandates
  add column if not exists profile_name_at_consent text;

comment on column public.sepa_mandates.profile_name_at_consent is
  'PROJ-7: Der Profilname zum Zeitpunkt der Mandatserteilung. Weicht er vom Kontoinhaber ab, hat der Kunde das ausdrücklich bestätigt.';

-- 3. Dieselbe IBAN auf mehreren Kundenkonten finden.
--
--    Bei einer Familie ist das der Normalfall, bei einem Angreifer das
--    Muster. Die Antwort gehört der Verwaltung, nicht dem Kunden — deshalb
--    eine abgesicherte Funktion und keine Policy-Erweiterung.
create or replace function public.admin_count_mandate_iban_sharers(p_mandate_id uuid)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select count(distinct m.customer_id)::integer
  from sepa_mandates m
  where "current_role"() = 'admin'
    and m.revoked_at is null
    and m.iban = (select iban from sepa_mandates where id = p_mandate_id)
    and m.customer_id <> (select customer_id from sepa_mandates where id = p_mandate_id);
$$;

comment on function public.admin_count_mandate_iban_sharers(uuid) is
  'PROJ-7: Wie viele andere Kunden dieselbe IBAN nutzen. Nur für die Verwaltung.';

revoke all on function public.admin_count_mandate_iban_sharers(uuid) from public, anon;
grant execute on function public.admin_count_mandate_iban_sharers(uuid) to authenticated;

create index if not exists idx_sepa_mandates_iban_aktiv
  on public.sepa_mandates (iban)
  where revoked_at is null;
