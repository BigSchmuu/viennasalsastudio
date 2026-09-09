-- PROJ-50: Nachrückung trägt Flatrate-Kunden direkt ein.
--
-- Bisher erzeugte das Nachrücken immer eine **offene Anfrage**, die der
-- Betreiber bestätigt — und genau dabei entstand für einen Flatrate-Kunden das
-- zweite Abo. Wer bereits zahlt, soll den frei gewordenen Platz bekommen, nicht
-- eine Anfrage.
--
-- Zugleich wird die Rechnung aufgeteilt: `promote_waitlist_internal` macht die
-- Arbeit ohne Rechteprüfung und ist nur aus anderen Funktionen erreichbar;
-- `promote_waitlist_for_course` bleibt der Zugang für den Betreiber. Das
-- braucht es, weil auch ein Kunde nachrücken lässt, wenn er einen Kursplatz
-- freigibt — mit seinen Rechten scheiterte die Admin-Prüfung.

create or replace function public.promote_waitlist_internal(p_course_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_max int;
  v_role_enabled boolean;
  v_max_diff int;
  v_role_gated boolean;
  v_leader_count int;
  v_follower_count int;
  v_entry waitlist_entries;
  v_flatrate uuid;
  v_promoted int := 0;
begin
  select max_participants, role_query_enabled, max_role_difference
    into v_max, v_role_enabled, v_max_diff
    from courses where id = p_course_id;

  v_role_gated := v_role_enabled and v_max_diff is not null;

  if v_max is null and not v_role_gated then
    return 0;
  end if;

  loop
    if v_max is not null then
      exit when kurs_belegung(p_course_id) >= v_max;
    end if;

    if v_role_gated then
      v_leader_count := kurs_rollenanzahl(p_course_id, 'leader');
      v_follower_count := kurs_rollenanzahl(p_course_id, 'follower');

      select * into v_entry
      from waitlist_entries
      where course_id = p_course_id
        and (
          dance_role is null
          or dance_role = 'both'
          or (dance_role = 'leader' and (v_leader_count + 1) - v_follower_count <= v_max_diff)
          or (dance_role = 'follower' and (v_follower_count + 1) - v_leader_count <= v_max_diff)
        )
      order by created_at asc
      limit 1;
    else
      select * into v_entry
      from waitlist_entries
      where course_id = p_course_id
      order by created_at asc
      limit 1;
    end if;

    exit when v_entry is null;

    -- Der heutige Zustand entscheidet, nicht der von damals: Wer die
    -- Warteliste noch als Einzelkurs-Interessent betreten hat, inzwischen aber
    -- eine Flatrate besitzt, bekommt den Kursplatz.
    v_flatrate := aktive_flatrate(v_entry.customer_id);

    if v_flatrate is not null then
      insert into course_memberships (customer_id, course_id, subscription_id, dance_role)
      values (v_entry.customer_id, p_course_id, v_flatrate, v_entry.dance_role)
      on conflict do nothing;
    else
      insert into course_bookings (
        customer_id, course_id, type, status, desired_plan, chosen_date, dance_role, price,
        terms_accepted_at, terms_version
      )
      values (
        v_entry.customer_id, p_course_id, 'regular', 'open', v_entry.desired_plan,
        v_entry.chosen_date, v_entry.dance_role,
        resolve_plan_price(p_course_id, v_entry.desired_plan, false),
        v_entry.terms_accepted_at, v_entry.terms_version
      );
    end if;

    perform enqueue_notification(
      v_entry.customer_id,
      'warteliste',
      jsonb_build_object('course_id', p_course_id, 'chosen_date', v_entry.chosen_date),
      'waitlist_promote:' || v_entry.id
    );

    delete from waitlist_entries where id = v_entry.id;
    v_promoted := v_promoted + 1;
  end loop;

  return v_promoted;
end;
$$;

-- Der Zugang für den Betreiber: nur noch Rechteprüfung, die Arbeit steht oben.
create or replace function public.promote_waitlist_for_course(p_course_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if public."current_role"() <> 'admin' then
    raise exception 'not authorized';
  end if;
  return promote_waitlist_internal(p_course_id);
end;
$$;

-- `create or replace function` setzt die Rechte zurück, und Supabase vergibt
-- EXECUTE per Default-Privileg sofort neu an `anon`. Ohne diesen Entzug stünde
-- die Nachrückung Nicht-Angemeldeten offen — siehe .claude/rules/backend.md.
revoke all on function public.promote_waitlist_internal(uuid) from public, anon, authenticated;
revoke all on function public.promote_waitlist_for_course(uuid) from public, anon;
grant execute on function public.promote_waitlist_for_course(uuid) to authenticated;
