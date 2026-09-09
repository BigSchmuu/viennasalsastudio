---
paths:
  - "src/app/api/**"
  - "src/lib/supabase*"
  - "supabase/**"
---

# Backend Development Rules

## Database (Supabase)
- ALWAYS enable Row Level Security on every table
- Create RLS policies for SELECT, INSERT, UPDATE, DELETE
- Add indexes on columns used in WHERE, ORDER BY, and JOIN clauses
- Use foreign keys with ON DELETE CASCADE where appropriate
- Never skip RLS - security first

## API Routes
- Validate all inputs using Zod schemas before processing
- Always check authentication: verify user session exists
- Return meaningful error messages with appropriate HTTP status codes
- Use `.limit()` on all list queries

## Query Patterns
- Use Supabase joins instead of N+1 query loops
- Use `unstable_cache` from Next.js for rarely-changing data
- Always handle errors from Supabase responses

## Stumm scheiternde Abfragen (RLS)

Eine Abfrage, die eine RLS-Regel nicht passiert, **schlägt nicht fehl — sie
liefert leer**. `error` ist `null`, `data` ist `[]`. Im Code sieht das genauso
aus wie „es gibt nichts", und deshalb bleibt der Fehler unsichtbar, bis jemand
die Anzeige mit echten Daten vergleicht.

Das hat in diesem Projekt bereits mehrfach zugeschlagen:
- PROJ-31: Die Geburtstags-Markierung in der Anwesenheitsliste war für Lehrer
  nie sichtbar (`profiles` erlaubt nur „eigene Zeile oder Admin").
- PROJ-30: Dieselbe Ursache bei den Leader/Follower-Markierungen
  (`course_bookings`).
- PROJ-49: Geburtstage, Probestunden, Rollenverteilung und offene Anwesenheiten
  blieben leer (`subscriptions`, `course_bookings`, `course_attendance`).

Jedes Mal waren die Tests grün, weil sie sich als Admin angemeldet hatten.

**Regeln:**
1. Vor jeder neuen Abfrage prüfen, **welche Rolle** sie ausführt und ob die
   Tabelle für diese Rolle eine `SELECT`-Regel hat. Tabellen ohne jede Regel
   (z. B. `course_attendance`, `course_session_notes`) sind ausschließlich über
   `SECURITY DEFINER`-Funktionen lesbar.
2. Daten, die eine Lehrkraft über ihre Kurse braucht, laufen über eine solche
   Funktion mit dem Wächter
   `is_course_teacher(course_id) or "current_role"() = 'admin'` — siehe
   `get_course_participants`, `get_course_attendance_dates`,
   `get_course_active_subscribers`, `get_course_trial_bookings`,
   `get_course_dance_roles`, `get_last_session_notes`.
3. `error` **immer** prüfen und protokollieren, auch wenn das Ergebnis nur
   angezeigt wird. Eine leere Liste ohne Fehlerprüfung ist eine unbeantwortete
   Frage.
4. E2E-Tests für Lehrer-Funktionen melden sich als **Lehrer** an, nicht als
   Admin. Und sie prüfen eine Zahl, die es ohne die Daten nicht gäbe:
   „0 Leader" besteht sonst denselben Test wie „3 Leader".

## Security
- Never hardcode secrets in source code
- Use environment variables for all credentials
- Validate and sanitize all user input
- Use parameterized queries (Supabase handles this)
