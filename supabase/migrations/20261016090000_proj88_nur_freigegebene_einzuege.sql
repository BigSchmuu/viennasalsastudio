-- PROJ-88, Nachtrag: Angerechnet wird nur ein **freigegebener** Einzug.
--
-- Der erste Entwurf verband die Positionen mit ihrem Lauf, ohne zu fragen, ob
-- der Lauf freigegeben ist. Ein Entwurf -- vorbereitet, aber nicht bei der Bank
-- hochgeladen -- zaehlte damit als bezahlt. Wer einen Lauf angelegt und noch
-- nicht freigegeben hat, sah beim Upgrade eine zu kleine Differenz: Der
-- Betreiber haette Geld angerechnet, das nie geflossen ist.
--
-- Gefunden hat das der Betreiber am ersten echten Fall: zwei Abos ueber je
-- 65 Euro, nichts eingezogen -- und die Karte bot 145 Euro mit 80 Euro
-- Differenz an, also genau einen angerechneten Beitrag zu viel.
--
-- `released_at` ist auch sonst die Grenze, ab der ein Lauf Geld bedeutet: Erst
-- damit entstehen die Rechnungen und gehen die Ankuendigungen raus (PROJ-47,
-- PROJ-61).
create or replace function public.flatrate_upgrade_anrechnung(p_customer_id uuid)
returns table (
  subscription_id uuid,
  bezeichnung text,
  betrag numeric,
  eingang date,
  art text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if p_customer_id <> auth.uid() and "current_role"() <> 'admin' then
    raise exception 'not authorized';
  end if;

  return query
  select
    s.id,
    coalesce(c.name, s.name, 'Abo'),
    sci.amount,
    r.due_date,
    'lastschrift'::text
  from subscriptions s
  join sepa_collection_items sci on sci.subscription_id = s.id
  join sepa_collection_runs r on r.id = sci.run_id
  left join courses c on c.id = s.course_id
  where s.customer_id = p_customer_id
    and s.status = 'active'
    and s.course_id is not null
    -- Nur freigegebene Laeufe. Ein Entwurf ist eine Absicht, kein Geld.
    and r.released_at is not null
    -- Zurueckgebuchtes zaehlt nicht: Geld, das zurueckkam, ist nicht bezahlt.
    and sci.bounced_at is null
    and r.due_date >= public.heute_wien() - 28
    and r.due_date <= public.heute_wien()

  union all

  -- Barzahlung: Ein Barzahler hat kein Mandat und damit keinen Einzug, aber er
  -- hat bezahlt. Ohne diese Zeile zahlte er den vollen Flatrate-Preis obendrauf.
  select
    s.id,
    coalesce(c.name, s.name, 'Abo'),
    z.amount,
    z.paid_on,
    'barzahlung'::text
  from subscriptions s
  join cash_payments z on z.subscription_id = s.id
  left join courses c on c.id = s.course_id
  where s.customer_id = p_customer_id
    and s.status = 'active'
    and s.course_id is not null
    and z.paid_on >= public.heute_wien() - 28
    and z.paid_on <= public.heute_wien()

  order by 4 desc;
end;
$$;

revoke all on function public.flatrate_upgrade_anrechnung(uuid) from public, anon;
grant execute on function public.flatrate_upgrade_anrechnung(uuid) to authenticated;
