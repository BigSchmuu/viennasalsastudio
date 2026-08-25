-- PROJ-30: Die Rollenwahl ist Pflicht, wo der Kurs sie abfragt.
--
-- Bisher war sie optional. Die Sperre in der Oberflaeche allein reicht nicht --
-- sie ist eine Behauptung des Browsers, wie beim Preis (PROJ-41) und bei der
-- AGB-Zustimmung (PROJ-42). Ohne die Rolle kann der Betreiber das
-- Rollenverhaeltnis im Kurs nicht steuern, und genau dafuer gibt es die Abfrage.
--
-- Nur wo role_query_enabled gesetzt ist: bei allen anderen Kursen gaebe es
-- nichts zu waehlen, und eine Pflicht waere dort sinnlos.
--
-- Bestehende Buchungen ohne Rolle bleiben, wie sie sind. Sie nachtraeglich zu
-- verlangen hiesse, eine Angabe zu erfinden, die niemand gemacht hat.
create or replace function public.require_dance_role(p_course_id uuid, p_dance_role text)
returns void
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_enabled boolean;
begin
  select role_query_enabled into v_enabled from courses where id = p_course_id;
  if coalesce(v_enabled, false) and coalesce(nullif(trim(p_dance_role), ''), null) is null then
    raise exception 'dance role required';
  end if;
end;
$$;

comment on function public.require_dance_role(uuid, text) is
  'PROJ-30: Wirft, wenn ein Kurs die Tanzrolle abfragt, aber keine uebergeben wurde.';
