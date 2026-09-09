-- PROJ-50: Kursplätze — „wer ist in diesem Kurs?" bekommt eine einzige Antwort.
--
-- Bisher steckte die Antwort in `subscriptions.course_id`. Bei einer Flatrate
-- ist die Spalte leer, und deshalb war ein Flatrate-Kunde im gesamten
-- Kursbetrieb unsichtbar: nicht in der Anwesenheitsliste, nicht in der
-- Kursgrenze, nicht in der Rollenbalance, ohne Benachrichtigung bei Ausfall,
-- ohne Selbst-Check-in. Und weil die Sperre „bereits angemeldet" dieselbe
-- Spalte prüft, entstand bei jedem weiteren Kurs ein zweites Abo mit eigenem
-- Preis.

-- 1. Der Kursplatz.
--
-- Was jemand zahlt, steht weiterhin ausschließlich am Abo. Hier steht nur,
-- wo er drin ist — das sind zwei Fragen, und genau ihre Vermischung war der
-- Fehler.
--
-- Die Tanzrolle gehört an den Kursplatz, nicht ans Abo: Jemand kann in Salsa
-- Leader und in Bachata Follower sein.
create table if not exists public.course_memberships (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  dance_role text check (dance_role in ('leader', 'follower', 'both')),
  started_on date not null default public.heute_wien(),
  -- Beendet statt gelöscht: Ein beendeter Platz ist die Erinnerung, aus der
  -- nach einer Pause der Vorschlag „das waren deine Kurse" entsteht — und er
  -- erklärt später, warum jemand im Mai in einer Anwesenheitsliste stand.
  ended_on date,
  created_at timestamptz not null default now()
);

-- Ein Kunde kann in einem Kurs nur einmal gleichzeitig sitzen. Frühere,
-- beendete Plätze im selben Kurs bleiben davon unberührt.
create unique index if not exists course_memberships_ein_offener_platz
  on public.course_memberships (customer_id, course_id)
  where ended_on is null;

create index if not exists course_memberships_kurs_offen
  on public.course_memberships (course_id) where ended_on is null;
create index if not exists course_memberships_abo
  on public.course_memberships (subscription_id);

alter table public.course_memberships enable row level security;

-- Lesen darf man die eigenen Plätze; alles andere läuft über Funktionen.
-- Schreibrechte gibt es bewusst keine: Hinzufügen und Entfernen brauchen die
-- Kursgrenze unter Sperre, und das ist im Anwendungscode nicht zu haben.
create policy "CourseMemberships: eigene lesen oder Admin"
  on public.course_memberships for select
  using ((select auth.uid()) = customer_id or public."current_role"() = 'admin');

-- 2. Die eine Tür.
--
-- Ab hier fragt niemand mehr selbst nach, wer in einem Kurs ist. Kursgebundene
-- Abos und Flatrate-Plätze stehen hier nebeneinander, und für den Leser sieht
-- beides gleich aus.
--
-- Zehn Stellen beantworteten diese Frage bisher getrennt. Eine Definition kann
-- falsch sein — zehn laufen auseinander.
create or replace view public.course_members as
  -- Kursgebundenes Abo: der Kurs steht am Abo, die Rolle an der Buchung, die
  -- es erzeugt hat.
  select
    s.course_id,
    s.customer_id,
    s.id           as subscription_id,
    cb.dance_role,
    'abo'::text    as quelle
  from public.subscriptions s
  left join public.course_bookings cb
    on cb.subscription_id = s.id and cb.type = 'regular'
  where s.status = 'active' and s.course_id is not null
union all
  -- Flatrate: der Kurs steht am Platz. Ein pausiertes oder gekündigtes Abo
  -- zählt hier nicht mehr mit, auch wenn der Platz noch offen wäre — die
  -- doppelte Bedingung ist Absicht.
  select
    m.course_id,
    m.customer_id,
    m.subscription_id,
    m.dance_role,
    'flatrate'::text as quelle
  from public.course_memberships m
  join public.subscriptions s on s.id = m.subscription_id
  where m.ended_on is null and s.status = 'active';

comment on view public.course_members is
  'PROJ-50: Die einzige Antwort auf „wer ist in diesem Kurs?". Vereint kursgebundene Abos und Flatrate-Kursplätze. Keine Lesestelle darf subscriptions.course_id oder course_memberships direkt dafür befragen.';

-- Die Sicht gehört dem Eigentümer und läuft deshalb an RLS vorbei; sie wird
-- ausschließlich innerhalb von SECURITY-DEFINER-Funktionen benutzt, die ihren
-- eigenen Zaun mitbringen.
revoke all on public.course_members from public, anon, authenticated;

-- 3. Ein Abo, das nicht mehr aktiv ist, hat keine Kursplätze.
--
-- Als Trigger und nicht an den einzelnen Schreibstellen: Pausieren und
-- Kündigen passieren an fünf verschiedenen Orten — Selbstbedienung, Admin,
-- Stapelvorgang, fällige Änderungen aus dem Cron, Kursausfall. Eine Regel an
-- der Tabelle gilt für alle fünf, auch für den sechsten, den es noch nicht
-- gibt.
--
-- Beendet wird, statt nur ausgeblendet: Sonst käme ein Kunde nach der Pause
-- stillschweigend in Kurse zurück, die inzwischen voll sind.
create or replace function public.beende_kursplaetze_bei_abo_ende()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status is distinct from 'active' and old.status = 'active' then
    update course_memberships
    set ended_on = public.heute_wien()
    where subscription_id = new.id and ended_on is null;
  end if;
  return new;
end;
$$;

drop trigger if exists abo_ende_beendet_kursplaetze on public.subscriptions;
create trigger abo_ende_beendet_kursplaetze
  after update of status on public.subscriptions
  for each row
  execute function public.beende_kursplaetze_bei_abo_ende();
