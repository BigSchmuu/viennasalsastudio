-- PROJ-16: Der Betreiber sieht, welche Benachrichtigungen nicht angekommen sind.
--
-- Bisher endete jede Zeile der Warteschlange auf `processed` — ob die E-Mail
-- wirklich hinausging, stand nur in `email_status` und `error_detail`, und die
-- las niemand. Eine Bestätigung, die nie ankam, erfuhr der Betreiber vom
-- Kunden oder gar nicht.
--
-- `notification_queue` hat RLS ohne Policies (Absicht: eine Postausgangs-Liste
-- gehört keinem Kunden). Eine gewöhnliche Abfrage aus dem Admin-Bereich käme
-- deshalb **leer und ohne Fehler** zurück — ununterscheidbar von „alles
-- zugestellt". Genau deshalb eine SECURITY-DEFINER-Funktion mit eigener
-- Rechteprüfung statt einer neuen Policy.
create or replace function public.admin_list_failed_notifications(p_limit integer default 50)
returns table (
  id uuid,
  event_type text,
  customer_name text,
  email_status text,
  push_status text,
  error_detail text,
  created_at timestamptz,
  processed_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    q.id,
    q.event_type,
    coalesce(nullif(p.full_name, ''), 'Unbenannt') as customer_name,
    q.email_status,
    q.push_status,
    q.error_detail,
    q.created_at,
    q.processed_at
  from notification_queue q
  left join profiles p on p.id = q.customer_id
  where "current_role"() = 'admin'
    and (q.email_status = 'failed' or q.push_status = 'failed')
  order by q.processed_at desc nulls last, q.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

comment on function public.admin_list_failed_notifications(integer) is
  'PROJ-16: Nicht zugestellte Benachrichtigungen für den Admin-Bereich. Nur für die Verwaltung.';

-- `create or replace function` setzt die Rechte zurück, und die
-- Standardvorgaben von Supabase geben `anon` wieder ein Ausführungsrecht.
-- Deshalb ausdrücklich entziehen und nur angemeldeten Nutzern geben — die
-- Prüfung in der Funktion entscheidet dann, wer wirklich etwas sieht.
revoke all on function public.admin_list_failed_notifications(integer) from public, anon;
grant execute on function public.admin_list_failed_notifications(integer) to authenticated;

-- Ohne diesen Index läuft die Abfrage über die ganze Warteschlange; sie wächst
-- mit jeder verschickten Nachricht.
create index if not exists idx_notification_queue_fehlgeschlagen
  on public.notification_queue (processed_at desc)
  where email_status = 'failed' or push_status = 'failed';
