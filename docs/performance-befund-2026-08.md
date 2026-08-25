# Geschwindigkeit: Befund vom 2026-08-25

Gemessen wurde die Zeit bis zum ersten Byte (TTFB) gegen die Produktion, je sechs
Messungen pro Seite, ausgewertet über den Median.

## Behoben: Funktionen und Datenbank standen auf verschiedenen Kontinenten

Die Antwort-Kopfzeile sagte `x-vercel-id: fra1::iad1`. Zu lesen als: Die Anfrage kam in
**Frankfurt** an, wurde aber von einer Funktion in **Washington** bearbeitet — die dann die
Datenbank in **Frankfurt** (`eu-central-1`) abfragte. Jede einzelne Abfrage überquerte den
Atlantik zweimal.

Das erklärt, warum abfragelastige Seiten so viel langsamer waren als reine Textseiten: Es
war nicht die Datenbank und nicht der Code, sondern die Entfernung dazwischen.

**Behoben** mit `"regions": ["fra1"]` in `vercel.json`.

| Seite | vorher | nachher | |
|---|---|---|---|
| `/agb` | 279 ms | 208 ms | −26 % |
| `/kurse` | 255 ms | 139 ms | −46 % |
| `/stundenplan` | 564 ms | 223 ms | −61 % |
| `/events` | 376 ms | 194 ms | −48 % |

Danach `fra1::fra1`. Rauchprobe ohne Befund: Katalog, Stundenplan, Anmeldung und englische
Fassung funktionieren unverändert, keine Konsolenfehler.

## Offen, nach Wirkung sortiert

### 1. Die Anmeldung wird pro Seitenaufruf dreimal geprüft
`supabase.auth.getUser()` läuft in der Middleware, im Rahmen und noch einmal in der Seite.
Jeder Aufruf fragt den Auth-Dienst, also drei Runden statt einer. Dazu kommen im Rahmen
zwei weitere Abfragen (Rolle, Lehrerstatus) — vor jeder einzelnen Seite, auch vor solchen,
die davon nichts brauchen.

*Ansatz:* Das Ergebnis innerhalb einer Anfrage einmal ermitteln und weiterreichen
(React `cache()`).

*Erwartung:* Zwei bis vier gesparte Runden pro Seitenaufruf. Seit dem Regionswechsel ist
eine Runde deutlich billiger, der Gewinn also kleiner als vorher — aber er summiert sich
über jede Seite.

### 2. Nichts wird zwischengespeichert
Im Build ist **jede** Route als `ƒ` markiert, also bei jedem Aufruf frisch gerechnet — auch
AGB, Datenschutz und Impressum, die sich fast nie ändern. Ursache: Der gemeinsame Rahmen
liest die Anmeldung, wodurch alles darunter dynamisch wird.

*Ansatz:* Die reinen Textseiten aus dem angemeldeten Rahmen lösen, oder den Kopfbereich
clientseitig laden.

*Einordnung:* Bei 208 ms ist der Leidensdruck gering.

### 3. 29 Testkurse im öffentlichen Katalog
`/kurse` lädt 43 Kurse, von denen nur 14 echt sind. Das ist zwar dreimal so viel Arbeit wie
nötig, macht bei dieser Größenordnung aber wenige Millisekunden aus — der eigentliche Grund,
sie zu entfernen, bleibt, dass Besucher sie sehen.

### 4. Datenbank-Hinweise
Der Supabase-Prüfer meldet fehlende Indizes auf Fremdschlüsseln, mehrfache RLS-Regeln und
drei Regeln, die `auth.<funktion>()` je Zeile neu auswerten.

**Bei 52 Kunden und 43 Kursen ist davon nichts messbar.** Es wird relevant, wenn die Tabellen
wachsen. Der Auslöser ist derselbe wie bei PROJ-35 in der PRD: grob ab tausend Kunden.

## Was *nicht* das Problem war

- **Supabase** ist gesund (`ACTIVE_HEALTHY`), die Abfragen sind schnell.
- **Vercel** war ebenfalls in Ordnung. Beide Dienste für sich waren nicht das Problem —
  ihre Entfernung zueinander war es.
