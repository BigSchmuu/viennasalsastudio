-- PROJ-84, Nachtrag: `close_cash_cycle` konnte nie laufen.
--
-- `delete from cash_entries;` ohne WHERE wird abgewiesen -- Supabase laesst
-- unqualifizierte DELETEs nicht zu (SQLSTATE 21000, "DELETE requires a WHERE
-- clause"), auch nicht in einer `security definer`-Funktion. Der Knopf "Zyklus
-- abschliessen" waere also mit einem Fehler zurueckgekommen.
--
-- Gefunden hat das der Datenbanktest zu PROJ-84, nicht der Betrieb.
create or replace function public.close_cash_cycle()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_anzahl integer;
begin
  if "current_role"() <> 'admin' then
    raise exception 'not authorized';
  end if;

  select count(*) into v_anzahl from cash_entries;
  -- Die Bedingung ist immer wahr und steht nur da, weil sie dastehen muss:
  -- `id` ist der Primaerschluessel und damit nie leer.
  delete from cash_entries where id is not null;
  return v_anzahl;
end;
$$;

revoke all on function public.close_cash_cycle() from public, anon;
grant execute on function public.close_cash_cycle() to authenticated;
