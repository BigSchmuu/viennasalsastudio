# Datenbank-Migrationen

Der komplette Datenbank-Stand liegt jetzt hier im Repo — Tabellen, Row-Level-Security-Policies
und alle Postgres-Funktionen. Vorher existierte das ausschließlich im Supabase-Projekt und war
weder überprüfbar noch aus Git wiederherstellbar (Audit-Befund P1-1).

## Was hier liegt

`migrations/` enthält jede Migration als eigene Datei, benannt nach dem Muster
`<zeitstempel>_<name>.sql`. Die Dateien wurden 1:1 aus dem Supabase-Projekt exportiert
(aus `supabase_migrations.schema_migrations`) und entsprechen exakt dem, was live angewendet ist.

Geprüft beim Export: alle 66 Tabellen, Views und Funktionen der Live-Datenbank kommen in
diesen Migrationen vor — es gibt keinen Bestandteil, der daran vorbei erstellt wurde.

## Wichtig für künftige Änderungen

Neue Datenbank-Änderungen **immer als Migration** anlegen, nie direkt im Supabase-Dashboard
klicken. Sonst entsteht genau die Lücke wieder, die dieser Export geschlossen hat.

Mit der Supabase-CLI:

```bash
supabase migration new <beschreibender_name>   # legt eine leere Migrationsdatei an
supabase db push                               # wendet offene Migrationen an
```

Die Zeitstempel im Dateinamen bestimmen die Reihenfolge — sie dürfen nachträglich nicht
geändert werden, weil Supabase bereits angewendete Migrationen an genau diesem Wert erkennt.

## Was hier bewusst *nicht* liegt

- **Keine Daten**, nur die Struktur. Kunden-, Buchungs- und Rechnungsdaten bleiben in Supabase.
- **Keine Zugangsdaten.** Die gehören in `.env.local` (nicht im Repo, siehe `.env.local.example`).
- **`config.toml` spiegelt nicht die Einstellungen des Live-Projekts.** Die Datei enthält die
  Standardwerte der Supabase-CLI für lokale Entwicklung (`supabase start`) und die
  Projekt-Verknüpfung. Änderungen daran wirken sich **nicht** auf die produktive Instanz aus —
  deren Einstellungen (Auth, SMTP, Rate Limits) werden weiterhin im Supabase-Dashboard gepflegt.

## Wiederherstellung im Ernstfall

Ein leeres Supabase-Projekt lässt sich damit auf denselben Stand bringen:

```bash
supabase link --project-ref <neue-projekt-id>
supabase db push
```

Danach fehlen nur noch die Umgebungsvariablen und die Inhalte (Kurse, Kunden usw.).
