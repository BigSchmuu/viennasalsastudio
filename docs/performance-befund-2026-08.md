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

### 1. ~~Die Anmeldung wird pro Seitenaufruf dreimal geprüft~~ — erledigt
`supabase.auth.getUser()` läuft in der Middleware, im Rahmen und noch einmal in der Seite.
Jeder Aufruf fragt den Auth-Dienst, also drei Runden statt einer. Dazu kommen im Rahmen
zwei weitere Abfragen (Rolle, Lehrerstatus) — vor jeder einzelnen Seite, auch vor solchen,
die davon nichts brauchen.

*Ansatz:* Das Ergebnis innerhalb einer Anfrage einmal ermitteln und weiterreichen
(React `cache()`).

**Umgesetzt am 2026-08-25** in `src/lib/auth/viewer.ts` mit `cache()` von React: Die Antwort
gilt für die Dauer *einer* Anfrage, nicht darüber hinaus. Zwei Besucher bekommen nie
dasselbe Ergebnis, und ein Abmelden wirkt sofort — beides in der Produktion nachgeprüft.

Die Runde in der Middleware bleibt: Sie frischt die Sitzung auf, ohne sie würden Kunden
zufällig abgemeldet.

**Ergebnis (10 Messungen warm, Bestwert je Seite):**

| Seite | nur Region | + Anmeldung gebündelt |
|---|---|---|
| `/agb` | 133 ms | 107 ms |
| `/kurse` | 123 ms | 121 ms |
| `/stundenplan` | 177 ms | 168 ms |
| `/events` | 156 ms | 148 ms |

**Ehrlich eingeordnet: ein kleiner Gewinn, 2–26 ms.** Das ist keine Enttäuschung, sondern
die Folge der ersten Änderung — eine Runde innerhalb Frankfurts kostet wenige Millisekunden
statt neunzig. Genau deshalb wurde die Region zuerst behoben.

Der bleibende Wert liegt weniger in der Zeit als darin, dass der Auth-Dienst ein Drittel
weniger Anfragen bekommt und der Code die Frage an einer Stelle beantwortet statt an drei.

Die Mediane schwanken bei diesen Größenordnungen stark (Messrauschen von außen), deshalb
sind hier die Bestwerte angegeben — sie sind der stabilste Vergleichspunkt.

### 2. Nichts wird zwischengespeichert (offen)
Im Build ist **jede** Route als `ƒ` markiert, also bei jedem Aufruf frisch gerechnet — auch
AGB, Datenschutz und Impressum, die sich fast nie ändern. Ursache: Der gemeinsame Rahmen
liest die Anmeldung, wodurch alles darunter dynamisch wird.

*Ansatz:* Die reinen Textseiten aus dem angemeldeten Rahmen lösen, oder den Kopfbereich
clientseitig laden.

*Einordnung:* Bei 208 ms ist der Leidensdruck gering.

### 3. 29 Testkurse im öffentlichen Katalog (offen)
`/kurse` lädt 43 Kurse, von denen nur 14 echt sind. Das ist zwar dreimal so viel Arbeit wie
nötig, macht bei dieser Größenordnung aber wenige Millisekunden aus — der eigentliche Grund,
sie zu entfernen, bleibt, dass Besucher sie sehen.

### 4. Datenbank-Hinweise (bewusst zurückgestellt)
Der Supabase-Prüfer meldet fehlende Indizes auf Fremdschlüsseln, mehrfache RLS-Regeln und
drei Regeln, die `auth.<funktion>()` je Zeile neu auswerten.

**Bei 52 Kunden und 43 Kursen ist davon nichts messbar.** Es wird relevant, wenn die Tabellen
wachsen. Der Auslöser ist derselbe wie bei PROJ-35 in der PRD: grob ab tausend Kunden.

## Was *nicht* das Problem war

- **Supabase** ist gesund (`ACTIVE_HEALTHY`), die Abfragen sind schnell.
- **Vercel** war ebenfalls in Ordnung. Beide Dienste für sich waren nicht das Problem —
  ihre Entfernung zueinander war es.

---

# Nachmessung vom 2026-09-08

Anlass: „lädt immer noch etwas langsam". Gemessen gegen `app.viennasalsastudio.at`.

| Messung | Wert |
|---|---|
| TTFB warm (`/kurse`, `/login`, `/stundenplan`) | 110–200 ms |
| **Erster Aufruf nach Ruhe** | **1,08 s** |
| Zwischenspeicher | `x-vercel-cache: MISS`, `cache-control: no-store` |
| JavaScript | 21 Dateien, 327 kB komprimiert |

Die Serverzeit ist also nicht mehr das Problem — die Arbeit vom August hält.
Der Betreiber bestätigt es: „Nach dem Kaltstart läuft die Website jetzt tatsächlich schnell."

## Behoben: Sentry lag im Bündel jeder Seite

Die beiden größten Brocken, heruntergeladen und durchsucht:

- `2648a76c…` — 69 kB → React DOM. Unvermeidbar.
- `4b23e31d…` — 61 kB → **Sentry** (120 Treffer auf „sentry", `tracesSampleRate`).

Ursache: `import * as Sentry from "@sentry/nextjs"` als **fester** Import in
`sentry-init.tsx` (Wurzel-Layout) **und** in `global-error.tsx`. Beide zusammen zogen
den Browser-Teil in das Startbündel jeder Seite — für einen Fall, der im Regelbetrieb
nie eintritt.

Beide auf einen nachgeladenen Import umgestellt; `SentryInit` startet ihn, wenn der
Browser sonst nichts zu tun hat (`requestIdleCallback`, Ersatzweg für ältere Safari).
Ohne DSN wird gar nichts geladen — in Tests bleibt das Paket vollständig aus dem Weg.

**Gemessen, lokal gegen den Produktionsbau:** 338,9 kB → **258,3 kB**, also **−80,6 kB**
(ein Viertel). Mehr als die veranschlagten 61 kB, weil mit Sentry auch dessen Anhang geht.

*Preis:* Ein Fehler in der allerersten Sekunde bleibt ungemeldet.

## Korrektur: „öffentliche Seiten zwischenspeichern" geht so nicht

Der Ansatz aus Punkt 2 oben war zu optimistisch formuliert. Nachgesehen, wer die
Anmeldung liest:

| Seite | liest die Anmeldung? |
|---|---|
| `/kurse` | **ja** — Mandat, Buchungen, Wartelisten-Einträge, aktive Abos |
| `/stundenplan` | **ja** — Abos, heutige Anwesenheit, Mandat |
| `/events` | **ja** |
| `/agb`, `/datenschutz`, `/impressum` | nein |

Die Seiten, die man einfach zwischenspeichern könnte, ruft kaum jemand auf. Die
wichtigen sind echt personalisiert — dort steht, ob *dieser* Besucher schon gebucht hat.

## Entschieden am 2026-09-08

1. **Kaltstart abstellen** (der eigentliche Leidensdruck): ein regelmäßiger Aufruf hält
   die Funktion warm. Setzt **Vercel Pro** voraus — Hobby erlaubt Cronjobs nur einmal
   täglich, und ein häufigerer Ausdruck lässt die *Bereitstellung fehlschlagen*. Also
   erst nach dem Tarifwechsel; vorher lässt sich nichts davon vorbereiten.
   *Ebenfalls erst mit Pro:* **Skew Protection** einschalten (Settings → Advanced).
   Sie bindet Anfragen einer noch offenen Seite an die Bereitstellung zurück, von der
   die Seite kam. Ohne sie scheitert eine Server Action aus einem alten Reiter nach
   jedem Ausrollen — dasselbe Symptom wie der Umleitungsfehler vom 2026-09-08
   (`TypeError: Failed to fetch`), aber eine andere Ursache, die der dortige Fix nicht
   abdeckt.
2. **Cache Components / PPR zurückgestellt.** In Next 16 stabil (`cacheComponents: true`)
   und das passende Werkzeug — statisches Gerüst sofort, personalisierte Teile strömen
   nach. Dreht aber die Caching-Regeln der gesamten App um und verlangt einen Umbau über
   alle Routen. Nicht in der Woche vor dem Start. Verdient nach dem Start eine eigene
   Spezifikation.
3. **Ignoriert:** Rechtstexte statisch (bringt fast nichts), Schriften (91 kB, aber mit
   `display: swap` nicht renderblockierend — eine der beiden zu streichen wäre eine
   Design-Entscheidung, keine Technikfrage).
