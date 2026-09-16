-- PROJ-58: Die zweite Stufe scharf schalten.
--
-- ====================================================================
-- ERST EINSPIELEN, WENN MINDESTENS EIN ADMIN-KONTO SEINE
-- AUTHENTICATOR-APP EINGERICHTET HAT.
-- ====================================================================
--
-- Ab hier beantwortet die Datenbank die Frage „ist das ein Admin?" nur noch
-- mit Ja, wenn die zweite Stufe in derselben Anmeldung bestätigt wurde. Rund
-- 50 Sicherheitsregeln hängen an dieser einen Auskunft und erben die Prüfung.
--
-- Warum überhaupt in der Datenbank und nicht nur in der Oberfläche: Adresse und
-- öffentlicher Zugangsschlüssel stehen in jeder ausgelieferten Seite. Wer ein
-- Admin-Passwort erbeutet, könnte damit an den Seiten vorbei direkt mit der
-- Datenbank sprechen. Eine Sperre, die nur in der Oberfläche sitzt, hielte
-- genau den nicht auf, gegen den sie gedacht ist.
--
-- Zur Signatur: `create or replace` mit **unveränderter** Parameterliste
-- ersetzt die Funktion und behält ihre Rechte. Eine geänderte Parameterliste
-- erzeugte dagegen eine zweite Fassung daneben, und jeder bisherige Aufruf
-- würde mehrdeutig — dieser Fehler hat in PROJ-56 sämtliche Ticketkäufe
-- lahmgelegt. Hier ändert sich nichts an der Signatur, deshalb ist es sicher.

create or replace function public.current_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select case
    -- Admin bleibt Admin nur mit bestätigter zweiter Stufe. Fehlt der Nachweis,
    -- lautet die Antwort schlicht „nichts" — und jede Regel, die 'admin'
    -- verlangt, greift nicht mehr.
    when p.role = 'admin'
     and coalesce(auth.jwt() ->> 'aal', 'aal1') is distinct from 'aal2'
    then null
    -- Kunden und Lehrkräfte bleiben unberührt.
    else p.role
  end
  from public.profiles p
  where p.id = auth.uid();
$$;

comment on function public.current_role() is
  'Rolle des Aufrufers. PROJ-58: Fuer Admins nur mit bestaetigter zweiter Stufe (aal2), sonst null.';
