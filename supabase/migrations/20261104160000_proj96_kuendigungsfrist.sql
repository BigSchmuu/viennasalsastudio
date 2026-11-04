-- PROJ-96: Kuendigungsfrist bis Sonntag, gerechnet nach Unterrichtswochen.
--
-- Bis hierher rechnete die Kuendigung `Anker + 28 * k` (`next_cycle_end`), der
-- Einzug dagegen `letzter Einzug + 28 Tage + Ferientage` (PROJ-70, in
-- TypeScript). Zwei Rhythmen in einem Abo: Das Profil nannte ein Zyklusende,
-- an dem gar nicht abgebucht wird, und mit jeder Schliessung drifteten beide
-- weiter auseinander.
--
-- Ab jetzt rechnet die Kuendigung wie der Einzug, und es gibt eine Frist:
-- gekuendigt werden muss bis zum letzten Sonntag vor dem Zyklusschluss.
-- Danach wirkt die Kuendigung zum naechsten Zyklusschluss.
--
-- Drei Funktionen, aufeinander aufbauend:
--   ferientage_zwischen      -- spiegelt ferientageZwischen (TypeScript)
--   naechste_faelligkeit     -- spiegelt naechsteFaelligkeit (TypeScript)
--   abo_kuendigungsfenster   -- Zyklusschluss, Frist, Wirksamkeitsdatum
--
-- ACHTUNG: Dieselbe Regel steht damit zweimal im Projekt -- hier in SQL fuer
-- die Kuendigung, in src/lib/sepa/faelligkeit.ts fuer den Einzug. Der Einzug
-- bewegt Geld und wird hier absichtlich nicht angefasst. Zusammengehalten
-- werden beide durch tests/PROJ-96-kuendigungsfrist-db.test.ts: Der Test
-- vergleicht beide Fassungen ueber dieselben Eingaben. Wer eine aendert, muss
-- die andere mitaendern, sonst wird der Test rot.


-- 1) Ferientage in (p_von, p_bis]
--
-- Der Starttag bleibt aussen vor: Das ist der Tag des letzten Einzugs, und er
-- zaehlt nicht noch einmal mit. Genau diese Grenze zieht auch die
-- TypeScript-Fassung, und ein Tag Unterschied waere ein Tag Frist.
create or replace function public.ferientage_zwischen(p_von date, p_bis date)
returns integer
language sql
stable
set search_path to 'public'
as $$
  select count(*)::int
  from generate_series(1, greatest(p_bis - p_von, 0)) as g(versatz)
  where exists (
    select 1
    from public.studio_holidays h
    where (p_von + g.versatz) between h.starts_on and h.ends_on
  );
$$;

comment on function public.ferientage_zwischen(date, date) is
  'PROJ-96: Ferientage nach p_von bis einschliesslich p_bis. Spiegelt ferientageZwischen in src/lib/sepa/faelligkeit.ts.';


-- 2) Der naechste Zyklusschluss nach einem Datum
--
-- Vier Wochen, verlaengert um die Ferientage, die dazwischen liegen. Die
-- Schleife ist Absicht: Schiebt eine Ferienwoche das Ziel nach hinten, koennen
-- im neuen Fenster weitere Ferientage liegen. Ohne das Nachrechnen waere eine
-- zweiwoechige Schliessung nur zur Haelfte beruecksichtigt.
--
-- Hoechstens 13 Runden -- dieselbe Grenze wie in TypeScript. Eine Schleife, die
-- nicht endet, waere in einer Funktion, die bei jedem Profilaufruf laeuft, das
-- groessere Uebel als ein ungenauer Rand nach einem Jahr Ferien.
create or replace function public.naechste_faelligkeit(p_letzter date)
returns date
language plpgsql
stable
set search_path to 'public'
as $$
declare
  v_ziel date := p_letzter + 28;
  v_gezaehlt integer := -1;
  v_tage integer;
begin
  for i in 1..13 loop
    v_tage := public.ferientage_zwischen(p_letzter, v_ziel);
    exit when v_tage = v_gezaehlt;
    v_gezaehlt := v_tage;
    v_ziel := p_letzter + 28 + v_tage;
  end loop;

  return v_ziel;
end;
$$;

comment on function public.naechste_faelligkeit(date) is
  'PROJ-96: Vier Unterrichtswochen nach p_letzter. Spiegelt naechsteFaelligkeit in src/lib/sepa/faelligkeit.ts.';


-- 3) Das Kuendigungsfenster eines Abos
--
-- Drei Angaben aus einer Quelle. Getrennt gerechnet wuerden sie beim ersten
-- Umbau auseinanderlaufen -- und dann zeigt das Profil einen anderen Stichtag
-- als die Funktion, die ihn durchsetzt.
--
-- Als "letzter Einzug" zaehlt der juengste SEPA-Lauf, in dem dieses Abo steht,
-- **auch ein Entwurf**. Dieselbe Regel wie beim Einzug (PROJ-70): Zwei offene
-- Entwuerfe zum selben Zyklus waeren sonst zwei Abbuchungen. Gibt es keinen
-- Einzug, zaehlt der Anker des Abos -- ein neues Abo wartet auf nichts.
create or replace function public.abo_kuendigungsfenster(p_subscription_id uuid)
returns table (
  zyklusschluss date,
  frist date,
  wirksam_zum date,
  frist_abgelaufen boolean
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_abo subscriptions;
  v_start date;
  v_heute date := public.heute_wien();
  v_schluss date;
  v_frist date;
begin
  select * into v_abo from subscriptions where id = p_subscription_id;
  if not found then
    raise exception 'subscription not found';
  end if;

  -- Das eigene Abo, oder die Verwaltung. Ohne diese Pruefung waere das Fenster
  -- eines fremden Abos fuer jeden Angemeldeten lesbar -- harmlos im Inhalt,
  -- aber eine Auskunft darueber, wer ueberhaupt ein Abo hat.
  if not (v_abo.customer_id = auth.uid() or "current_role"() = 'admin') then
    raise exception 'not authorized';
  end if;

  select max(r.due_date) into v_start
  from sepa_collection_items i
  join sepa_collection_runs r on r.id = i.run_id
  where i.subscription_id = p_subscription_id;

  v_start := coalesce(v_start, v_abo.cycle_anchor_date);

  -- Vorwaerts, bis der Schluss nicht mehr in der Vergangenheit liegt. Ein Abo,
  -- das lange nicht eingezogen wurde, haette sonst einen Zyklusschluss von
  -- vorletztem Jahr. `<` und nicht `<=`: Faellt der Schluss auf heute, ist er
  -- noch erreichbar -- genau der Fall "Zyklusschluss an einem Sonntag", in dem
  -- die Frist derselbe Tag ist.
  v_schluss := public.naechste_faelligkeit(v_start);
  while v_schluss < v_heute loop
    v_schluss := public.naechste_faelligkeit(v_schluss);
  end loop;

  -- Der letzte Sonntag auf oder vor dem Zyklusschluss. isodow: Montag 1 bis
  -- Sonntag 7, also ist `mod 7` genau der Abstand zum Sonntag davor -- und
  -- null, wenn der Schluss selbst ein Sonntag ist.
  v_frist := v_schluss - (extract(isodow from v_schluss)::int % 7);

  return query
  select
    v_schluss,                                                    -- zyklusschluss
    v_frist,                                                      -- frist
    case when v_heute <= v_frist
      then v_schluss
      else public.naechste_faelligkeit(v_schluss)
    end,                                                          -- wirksam_zum
    (v_heute > v_frist);                                          -- frist_abgelaufen
end;
$$;

comment on function public.abo_kuendigungsfenster(uuid) is
  'PROJ-96: Zyklusschluss, Kuendigungsfrist (letzter Sonntag davor) und das Datum, zu dem eine Kuendigung heute wirkt.';


-- 4) Kuendigen und Pausieren holen das Datum aus der neuen Rechnung
--
-- Signatur unveraendert, also genuegt `create or replace`. Geaendert ist eine
-- Zeile: `pending_effective_date` kommt aus `abo_kuendigungsfenster` statt aus
-- `next_cycle_end(cycle_anchor_date)`.
--
-- Die Frist gilt fuer Pausieren genauso. Sonst waere die Pause das Schlupfloch:
-- erst pausieren, dann aus der Pause heraus kuendigen.
create or replace function public.self_schedule_subscription_change(
  p_subscription_id uuid,
  p_new_pending_status text,
  p_cancellation_reason text default null,
  p_cancellation_note text default null
)
returns subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row subscriptions;
  v_wirksam date;
begin
  if p_new_pending_status not in ('paused', 'cancelled') then
    raise exception 'invalid pending status';
  end if;

  -- Das Fenster wird vor dem Schreiben geholt: Die Funktion prueft selbst, ob
  -- das Abo dem Anrufer gehoert, und wirft sonst. Das `where` unten tut es
  -- noch einmal -- doppelt, weil diese Funktion `security definer` ist und ein
  -- fremdes Abo hier nie beschrieben werden darf.
  select f.wirksam_zum into v_wirksam
  from public.abo_kuendigungsfenster(p_subscription_id) f;

  update subscriptions
  set pending_status = p_new_pending_status,
      pending_effective_date = v_wirksam,
      -- Grund und Notiz gehoeren zur Kuendigung. Bei einer Pause werden sie
      -- geleert: Wer erst kuendigt, es zuruecknimmt und dann pausiert, haette
      -- sonst einen Grund am Abo, der nichts mehr erklaert.
      cancellation_reason = case when p_new_pending_status = 'cancelled'
        then nullif(trim(coalesce(p_cancellation_reason, '')), '') else null end,
      cancellation_note = case when p_new_pending_status = 'cancelled'
        then nullif(trim(coalesce(p_cancellation_note, '')), '') else null end
  where id = p_subscription_id
    and customer_id = auth.uid()
    and status = 'active'
    and pending_status is null
  returning * into v_row;

  if not found then
    raise exception 'subscription not eligible for this change';
  end if;

  return v_row;
end;
$$;


-- `create or replace function` setzt die Rechte zurueck, und Supabase vergibt
-- EXECUTE per Default-Privileg neu an `anon`. Siehe .claude/rules/backend.md.
revoke all on function public.ferientage_zwischen(date, date) from public, anon;
revoke all on function public.naechste_faelligkeit(date) from public, anon;
revoke all on function public.abo_kuendigungsfenster(uuid) from public, anon;
revoke all on function public.self_schedule_subscription_change(uuid, text, text, text) from public, anon;

grant execute on function public.ferientage_zwischen(date, date) to authenticated;
grant execute on function public.naechste_faelligkeit(date) to authenticated;
grant execute on function public.abo_kuendigungsfenster(uuid) to authenticated;
grant execute on function public.self_schedule_subscription_change(uuid, text, text, text) to authenticated;


-- `next_cycle_end` bleibt liegen und verliert nur seine Aufrufer. Loeschen
-- waere ein zweiter Eingriff an einer Funktion, die in drei Migrationen steht
-- und ueber types.ts nach aussen sichtbar ist -- ohne Not.
comment on function public.next_cycle_end(date) is
  'Veraltet seit PROJ-96: starres 28-Tage-Raster ohne Ferien. Die Kuendigung rechnet jetzt mit abo_kuendigungsfenster.';
