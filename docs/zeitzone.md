# Zeitzone

Das Studio steht in Wien. Server und Datenbank laufen in UTC. Jede Frage nach
„welcher Tag ist heute" muss deshalb ausdrücklich beantwortet werden — sonst
liegt sie zwischen Mitternacht und 01:00/02:00 Wiener Zeit um einen Tag daneben.

## Anwendungsseite

`src/lib/constants/zeitzone.ts`:

- `STUDIO_TIMEZONE` — `"Europe/Vienna"`, die einzige Stelle mit dem Literal.
- `heuteInWien()` — heutiger Kalendertag als `YYYY-MM-DD`.
- `heuteAlsDatumInWien()` — derselbe Tag als `Date` auf Mitternacht.

Statt `new Date()` für Datumsvergleiche immer diese Funktionen. Alle Formatierer
in `src/lib/formatting.ts` übergeben `timeZone: STUDIO_TIMEZONE`; next-intl
bekommt die Zeitzone in der Request-Konfiguration.

## Datenbankseite

`public.heute_wien()` — heutiger Kalendertag in Wien, `stable`.

**In Datenbankfunktionen nie `current_date` verwenden.** Die Datenbank läuft in
UTC (`current_setting('TimeZone')` = `UTC`), `current_date` ist dort nachts noch
der Vortag. Ebenso vorsichtig bei `timestamptz::date`: der Cast rechnet
ebenfalls in UTC um. Richtig ist `(spalte at time zone 'Europe/Vienna')::date`.

Uhrzeiten aus `course_schedule` (`start_time`, `end_time`) sind Wiener
Wandzeit, keine UTC-Zeiten — beim Bilden eines `timestamptz` also
`at time zone 'Europe/Vienna'` anwenden.

## Nachprüfen

Diese Abfrage muss leer bleiben:

```sql
select p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and lower(p.prosrc) like '%current_date%';
```

Ebenso dürfen Spalten-Vorgabewerte kein `current_date` mehr enthalten
(`subscriptions.cycle_anchor_date` war der letzte Fall).
