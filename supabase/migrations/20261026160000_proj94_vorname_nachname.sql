-- PROJ-94: Vorname und Nachname getrennt.
--
-- Bis hierher stand der Name in einem Feld (`profiles.full_name`), und die
-- Registrierung fragte ihn gar nicht ab -- sie wollte nur E-Mail und Passwort.
-- Ein Kunde konnte also buchen und auf einer Rechnung stehen, ohne dass sein
-- Name irgendwo stand.
--
-- **`full_name` bleibt** und wird von einem Trigger gepflegt. Eine
-- `generated`-Spalte waere die schoenere Invariante, ist aber nicht
-- beschreibbar: 42 Dateien lesen die Spalte, 19 Datenbankfunktionen sortieren
-- danach, und 34 Schreibzugriffe in 47 Testdateien wuerden auf einen Schlag
-- brechen. Der Trigger haelt dieselbe Wahrheit -- sind Teile vorhanden,
-- gewinnen sie -- und laesst alles Bestehende unberuehrt.

-- 1. Die zwei Felder.
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text;

alter table public.profiles
  drop constraint if exists profiles_namen_laenge;
alter table public.profiles
  add constraint profiles_namen_laenge
  check (
    (first_name is null or char_length(first_name) <= 100)
    and (last_name is null or char_length(last_name) <= 100)
  );

comment on column public.profiles.first_name is
  'PROJ-94: Vorname. Pflicht bei der Registrierung; bei Konten, die der Betreiber anlegt, kann der Nachname fehlen.';
comment on column public.profiles.last_name is
  'PROJ-94: Nachname. NULL ist erlaubt -- an der Tuer kennt man manchmal nur einen Namen.';

-- 2. Der zusammengesetzte Name folgt den Teilen.
--
-- Sind Teile vorhanden, gewinnen sie: Ein direktes Schreiben auf `full_name`
-- wird dann ueberschrieben. Sind keine vorhanden, bleibt `full_name`
-- beschreibbar wie bisher -- genau das haelt die Gast-Eintragung an der Tuer
-- und die bestehenden Testhelfer am Leben.
create or replace function public.profiles_namen_zusammensetzen()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.first_name is not null or new.last_name is not null then
    new.full_name := nullif(
      btrim(coalesce(btrim(new.first_name), '') || ' ' || coalesce(btrim(new.last_name), '')),
      ''
    );
  end if;
  return new;
end;
$$;

comment on function public.profiles_namen_zusammensetzen() is
  'PROJ-94: Haelt profiles.full_name mit first_name/last_name im Einklang. Sind Teile vorhanden, gewinnen sie.';

drop trigger if exists profiles_namen_setzen on public.profiles;
create trigger profiles_namen_setzen
  before insert or update of first_name, last_name, full_name on public.profiles
  for each row execute function public.profiles_namen_zusammensetzen();

revoke execute on function public.profiles_namen_zusammensetzen() from public, anon, authenticated;

-- 3. Der Bestand zieht um: geteilt am **letzten** Leerzeichen.
--
-- Zweit- und Drittvornamen sind haeufiger als mehrteilige Nachnamen, deshalb
-- wird "Anna Maria Mueller" zu "Anna Maria" + "Mueller". Bei einem Praefix
-- ("van der Berg") trifft es nicht zu -- bewusst in Kauf genommen
-- (Entscheidung des Betreibers), die Ausnahmen korrigiert die Verwaltung.
-- Dieselbe Regel steht als pruefbare Funktion in src/lib/namen.ts.
--
-- Nur wo noch nichts steht: Ein zweiter Lauf darf eine inzwischen von Hand
-- korrigierte Teilung nicht ueberschreiben.
update public.profiles p
set first_name = nullif(t.vorname, ''),
    last_name  = nullif(t.nachname, '')
from (
  select
    id,
    case when position(' ' in n) = 0
         then n
         else left(n, length(n) - position(' ' in reverse(n)))
    end as vorname,
    case when position(' ' in n) = 0
         then ''
         else right(n, position(' ' in reverse(n)) - 1)
    end as nachname
  from (
    select id, btrim(regexp_replace(coalesce(full_name, ''), '\s+', ' ', 'g')) as n
    from public.profiles
  ) bereinigt
  where n <> ''
) t
where p.id = t.id
  and p.first_name is null
  and p.last_name is null;

-- 4. Die Registrierung bringt den Namen mit.
--
-- Das Profil entsteht in diesem Trigger, bevor die Anwendung es sehen kann.
-- Supabase legt die Metadaten der Anmeldung in `auth.users.raw_user_meta_data`
-- ab; von dort kommt der Name. Ein nachtraegliches `update` waere ein zweiter
-- Schritt, der scheitern kann -- und dann gaebe es ein Konto ohne Namen,
-- obwohl er Pflicht ist.
--
-- Die Metadaten kommen vom Client. Geprueft wird deshalb serverseitig in der
-- Server-Action `signUp`; hier wird nur noch geputzt und auf 100 Zeichen
-- begrenzt, damit die CHECK-Bedingung oben nicht die Registrierung abbricht.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, first_name, last_name)
  values (
    new.id,
    'customer',
    nullif(left(btrim(new.raw_user_meta_data->>'first_name'), 100), ''),
    nullif(left(btrim(new.raw_user_meta_data->>'last_name'), 100), '')
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
