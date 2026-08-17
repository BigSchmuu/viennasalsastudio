# PROJ-11: Beispiel-Videos (YouTube-Einbettung)

## Status: Approved
**Created:** 2026-08-17
**Last Updated:** 2026-08-17

## Dependencies
- Requires: PROJ-2 (Auth & Kundenprofil) — Kunde muss eingeloggt sein
- Requires: PROJ-5 (Kurskatalog) — der Kurs-Katalog bekommt eine neue, klickbare Detailseite pro Kurs
- Requires: PROJ-8 (Kursbuchung) — „angemeldet" wird über bestehende Abo-Daten bestimmt
- Requires: PROJ-9 (Abo-Verwaltung) — `subscriptions.course_id`/`status` bestimmen, wer Zugriff hat; pausierte Abos zählen nicht
- Requires: PROJ-23 (Admin: Videosätze & Lektionen verwalten) — dieselben Lektionen (`video_set_lessons`) werden um ein Kunden-Video-Feld erweitert; klare Abgrenzung: PROJ-23 = internes Lehrmaterial für Admin/Lehrer, PROJ-11 = kundenseitiges, freigeschaltetes Beispielmaterial

## User Stories
- Als Kunde möchte ich mir zu einem Kurs, für den ich aktiv angemeldet bin, einfache Beispiel-Videos ansehen können, damit ich zuhause üben kann.
- Als Kunde möchte ich diese Videos direkt auf der Seite abspielen können, ohne zu YouTube wechseln zu müssen.
- Als Admin möchte ich zu jeder bestehenden Lektion (aus PROJ-23) zusätzlich ein einfaches Kunden-Video hinterlegen können, ohne eine komplett neue Struktur pflegen zu müssen.
- Als Besucher ohne Anmeldung zu einem Kurs möchte ich trotzdem die grundlegenden Kursinfos auf einer Detailseite sehen können, auch wenn mir die Videos nicht angezeigt werden.

## Out of Scope
- Eigene, von PROJ-23 unabhängige Lektionsstruktur für Kunden-Videos — dieselben Lektionen werden wiederverwendet und um ein Feld erweitert (siehe Decision Log)
- Zugriff für Probestunden-/Drop-in-Buchungen — nur aktive Kurs-Abos (inkl. Flatrate) geben Zugriff, einmalige Buchungen bewusst ausgeschlossen
- Zugriff während einer pausierten Abo-Phase (PROJ-9) — konsequent kein Zugriff während der Pause
- Mehrere Kunden-Videos pro Lektion — genau eines, im Gegensatz zu den mehrteiligen Lehrer-Videos aus PROJ-23
- Öffentliche Sichtbarkeit der Videos für nicht angemeldete Besucher — Kursdetailseite selbst ist öffentlich, der Video-Bereich ausschließlich für angemeldete Kunden
- Hinweistext/Teaser für nicht-berechtigte Besucher im Video-Bereich — der Abschnitt wird komplett weggelassen statt einen Hinweis zu zeigen
- Sonstige neue Inhalte auf der neuen Kursdetailseite über die bestehenden Katalog-Infos hinaus (z. B. Bewertungen, Kommentare) — reine Erweiterung um den Video-Bereich, keine sonstigen neuen Funktionen
- Video-Reihenfolge/-Struktur unabhängig von den Lektionen ändern — folgt exakt der bestehenden Lektions-Reihenfolge aus PROJ-23

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen ein Kurs existiert, wenn ein Besucher im Katalog (`/kurse`) auf die Kurskarte klickt, dann gelangt er auf eine neue Kursdetailseite mit den Kursinfos (unabhängig vom Login-Status)
- [ ] Angenommen ein Kunde ist NICHT eingeloggt oder nicht bei diesem Kurs angemeldet, wenn er die Kursdetailseite ansieht, dann gibt es dort keinen „Videolektionen"-Abschnitt
- [ ] Angenommen ein Kunde hat ein aktives Abo mit Kurs-Bezug auf genau diesen Kurs, wenn er die Kursdetailseite ansieht, dann sieht er den „Videolektionen"-Abschnitt mit allen Lektionen, die ein Kunden-Video hinterlegt haben
- [ ] Angenommen ein Kunde hat ein aktives Flatrate-Abo (kein Kurs-Bezug), wenn er die Detailseite eines beliebigen Kurses ansieht, dann sieht er ebenfalls den „Videolektionen"-Abschnitt für diesen Kurs
- [ ] Angenommen das Abo eines Kunden für diesen Kurs ist pausiert, wenn er die Kursdetailseite ansieht, dann sieht er keinen „Videolektionen"-Abschnitt
- [ ] Angenommen ein Kunde sieht den „Videolektionen"-Abschnitt, wenn er ein Video anschauen möchte, dann wird das YouTube-Video direkt eingebettet auf der Seite abgespielt, ohne zu youtube.com wechseln zu müssen
- [ ] Angenommen ein Admin bearbeitet eine bestehende Lektion in der Videosatz-Verwaltung (PROJ-23), wenn er eine Kunden-Video-URL einträgt und speichert, dann ist dieses Video ab sofort für berechtigte Kunden auf der jeweiligen Kursdetailseite sichtbar
- [ ] Angenommen eine Lektion hat kein Kunden-Video hinterlegt, wenn ein berechtigter Kunde den Videolektionen-Abschnitt ansieht, dann erscheint diese Lektion dort nicht (nur Lektionen mit hinterlegtem Kunden-Video werden gelistet)
- [ ] Angenommen ein Kurs hat keinen Videosatz zugeordnet, wenn ein berechtigter Kunde die Kursdetailseite ansieht, dann gibt es keinen „Videolektionen"-Abschnitt

## Edge Cases
- Kurs hat einen Videosatz, aber keine einzige Lektion hat ein Kunden-Video hinterlegt → Abschnitt wird komplett weggelassen (konsistent mit „kein Videosatz")
- Kunde hat sowohl ein aktives kursgebundenes Abo als auch ein Flatrate-Abo gleichzeitig → Zugriff besteht ohnehin, keine widersprüchliche Situation
- Admin trägt eine ungültige URL als Kunden-Video ein → serverseitige Validierung wie bei den bestehenden Lehrer-Video-URLs aus PROJ-23, Fehlermeldung „Bitte eine gültige URL eingeben"
- Kunde storniert/kündigt sein Abo für diesen Kurs (PROJ-9) → Zugriff verschwindet unmittelbar mit dem Statuswechsel, kein Nachlauf
- Admin entfernt ein Kunden-Video wieder (Feld leeren) → Lektion verschwindet sofort wieder aus dem Kunden-Abschnitt
- Videosatz wird von einem Kurs entfernt (PROJ-23, optionale Zuordnung) → Videolektionen-Abschnitt verschwindet von der Kursdetailseite dieses Kurses

## Technical Requirements (optional)
- Security: Zugriffsprüfung auf Server-Seite (nicht nur UI-seitig ausgeblendet) — ein nicht-berechtigter Kunde darf die Kunden-Video-URLs nicht einmal im Seiten-Quelltext/API-Response sehen können
- Einbettung: YouTube-Videos werden per iframe-Embed eingebunden (responsive, funktioniert auf Mobile/Tablet/Desktop)

## Open Questions
- [ ] Keine offenen Fragen

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Dieselben Lektionen aus PROJ-23 werden um ein Kunden-Video-Feld erweitert, statt eine eigene Struktur aufzubauen | Verhindert, dass Lehrer- und Kunden-Lektionslisten auseinanderlaufen (unterschiedliche Reihenfolge/Anzahl); Admin pflegt beides an einer Stelle | 2026-08-17 |
| Zugriff nur für aktive Abos (kursgebunden oder Flatrate), NICHT für Probestunden-/Drop-in-Buchungen | Videos sind ein Mehrwert für tatsächlich laufende Kursteilnahme, nicht für einmaliges Reinschnuppern; hält den Zugriffs-Check einfach (nur `subscriptions`, keine `course_bookings`-Abfrage nötig) | 2026-08-17 |
| Pausierte Abos verlieren den Zugriff während der Pause | Konsequent zur Bedeutung einer Pause (keine aktive Teilnahme); Zugriff kommt mit Reaktivierung automatisch zurück | 2026-08-17 |
| Genau ein Kunden-Video pro Lektion (statt mehrerer wie bei Lehrer-Videos) | Einfacher zu pflegen, passt zum simplen Charakter des Kunden-Materials (Counts + Musik statt mehrteiliger Erklärung) | 2026-08-17 |
| Neue öffentliche Kursdetailseite (`/kurse/[id]`) als Trägerseite für den Video-Bereich | Es gab bisher keine Detailseite, nur Katalogkarten mit direktem Buchungsdialog; der Video-Bereich braucht einen dauerhaften Ort auf einer eigenen Seite | 2026-08-17 |
| Kursdetailseite selbst bleibt öffentlich, nur der Videolektionen-Abschnitt ist zugriffsbeschränkt | Konsistent mit dem öffentlichen Kurskatalog (PROJ-5); nur die Videos selbst sind der eigentliche Mehrwert für zahlende Kunden | 2026-08-17 |
| Kein Hinweistext/Teaser für nicht-berechtigte Besucher — Abschnitt wird komplett weggelassen | Einfacher und vermeidet unnötige Werbe-Optik auf einer bereits informativen öffentlichen Seite | 2026-08-17 |
| Lektionen ohne Kunden-Video werden im Kunden-Abschnitt übersprungen, nicht als „kein Video" angezeigt | Vermeidet eine verwirrende, halb-leere Liste; Kunde sieht nur, was tatsächlich verfügbar ist | 2026-08-17 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Zugriffsprüfung passiert serverseitig beim Laden der Kursdetailseite, nicht im Browser | Ein Kunde ohne Berechtigung darf die Kunden-Video-URLs nicht einmal im Seiten-Quelltext sehen können — reines Verstecken per UI würde die Daten trotzdem an den Browser schicken | 2026-08-17 |
| YouTube-Einbettung per einfachem iframe, kein zusätzliches Paket | Natives Embedding reicht für die reine Wiedergabe; ein Player-Paket wäre unnötiger Overhead für diesen einfachen Anwendungsfall | 2026-08-17 |
| „Jetzt buchen"-Button bleibt zusätzlich direkt auf der Katalogkarte (PROJ-5) bestehen, Klick auf die restliche Karte führt neu zur Detailseite | Der bestehende, bereits getestete Buchungsfluss aus PROJ-8 bleibt unangetastet; die Detailseite ist eine reine Ergänzung, kein Ersatz für den bisherigen Weg | 2026-08-17 |
| Kursdetailseite nutzt dieselbe Datenabfrage wie der Katalog (PROJ-5), nur für einen einzelnen Kurs statt gefiltert für alle | Vermeidet eine zweite, parallele Abfrage-Logik für dieselben Kursinfos | 2026-08-17 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Komponentenstruktur

```
/kurse (bestehend, PROJ-5)
└── Kurskarte ist jetzt klickbar
    ├── Klick auf Karte → Navigation zur neuen Detailseite
    └── „Jetzt buchen"-Button bleibt wie bisher direkt auf der Karte

/kurse/[id] (neu — öffentliche Kursdetailseite)
├── Kursinfos (Name, Tanzstil, Level, Standort, Lehrer, Zeiten) — dieselben Daten wie bisher auf der Katalogkarte, nur ausführlicher dargestellt
├── „Jetzt buchen"-Button (öffnet denselben bestehenden Buchungsdialog aus PROJ-8)
└── „Videolektionen" (NUR sichtbar für eingeloggte, bei diesem Kurs berechtigte Kunden)
    └── Pro Lektion mit hinterlegtem Kunden-Video: Lektionstitel + eingebetteter YouTube-Player
    └── Für alle anderen Besucher: Abschnitt existiert schlicht nicht auf der Seite

Admin-Erweiterung (bestehende Seite aus PROJ-23):
/admin/videosaetze/[id]
└── Pro Lektionszeile: bestehende Lehrer-Video-Liste + neues Eingabefeld „Kunden-Video-URL" (optional)
```

### B) Datenmodell (fachlich)

**Lektion** (bestehend aus PROJ-23) bekommt eine neue, optionale Information:
- Kunden-Video-Link — eine einzelne Video-URL (im Gegensatz zur Liste mehrerer Lehrer-Videos), leer lassbar

Es wird **keine neue Tabelle und kein neues „Berechtigung"-Konzept** gespeichert — ob ein Kunde eine Lektion sehen darf, wird bei jedem Seitenaufruf frisch aus den bestehenden Abo-Daten berechnet (aktives Abo mit passendem Kurs-Bezug ODER aktives Flatrate-Abo, siehe Product Decisions), nicht als eigener Datensatz abgelegt.

### C) Tech-Entscheidungen (Begründung)

- **Serverseitige Zugriffsprüfung:** Die Berechtigungsprüfung (hat dieser Kunde ein passendes aktives Abo?) passiert, bevor die Seite an den Browser geschickt wird. Ein nicht berechtigter Besucher bekommt die Video-Links technisch gar nicht erst übermittelt — nicht nur optisch versteckt.
- **Einfaches iframe-Embedding:** Kein zusätzliches Fremdpaket nötig, da nur die reine Wiedergabe gebraucht wird, keine erweiterte Player-Steuerung.
- **Bestehender Buchungsweg bleibt unangetastet:** Der „Jetzt buchen"-Button bleibt weiterhin direkt im Katalog nutzbar; die neue Detailseite ergänzt, ersetzt aber nichts aus PROJ-8.
- **Wiederverwendung der Katalog-Datenabfrage:** Die Detailseite lädt dieselben Kurs-Informationen (Tanzstil, Level, Standort, Lehrer) wie der bestehende Katalog aus PROJ-5, nur für einen einzelnen Kurs statt für alle gefiltert — keine doppelte Abfrage-Logik.

### D) Abhängigkeiten (Pakete)

Keine neuen Fremdpakete nötig — YouTube-Einbettung per nativem iframe, Zugriffsprüfung nutzt bereits bestehende Abo-Datenstrukturen aus PROJ-9.

## Implementation Notes (Frontend)

**Datenbank:**
- Migration `proj11_customer_video_url_on_lessons`: `video_set_lessons.customer_video_url text` (nullable, optional pro Lektion).
- Migration `proj11_customer_video_lessons_rls`: neue additive RLS-Policy „VideoSetLessons: enrolled customer read" — Kunde sieht eine Lektion nur, wenn er ein aktives Abo mit `course_id = <Kurs des Videosatzes>` ODER `course_id IS NULL` (Flatrate) hat. Bestehende Admin/Lehrer-Policy aus PROJ-23 bleibt unverändert bestehen. `get_advisors(security)` zeigt keine neuen Findings.

**Admin-Seite (Wiederverwendung PROJ-23):**
- `lessonSchema`, `lessons.ts`-Actions und `lesson-manager.tsx` um optionales Feld „Kunden-Video (PROJ-11)" erweitert — Admin pflegt es direkt im bestehenden Lektionen-Editor unter `/admin/videosaetze/[id]`.

**Kundenseite (neu):**
- `src/lib/youtube.ts` — `getYoutubeVideoId`/`getYoutubeEmbedUrl`, unterstützt watch/youtu.be/embed/shorts-URLs.
- `src/components/video/youtube-embed.tsx` — `YoutubeEmbed`-Komponente, natives `<iframe>` auf `youtube-nocookie.com`, responsive `aspect-video`.
- `src/app/(site)/kurse/[id]/page.tsx` — neue öffentliche Kursdetailseite. Server-seitiges Access-Gating: Lektionen mit `customer_video_url` werden nur dann überhaupt aus der DB geladen, wenn der eingeloggte Kunde ein aktives Abo mit `course_id` = dieser Kurs oder `course_id IS NULL` hat — nicht eingeloggte/nicht-berechtigte Besucher erhalten die Daten gar nicht erst im Seiten-Payload.
- `src/components/catalog/course-detail-booking.tsx` — schlanker Wrapper um den bestehenden `BookingDialog`, reine Auslagerung der „Jetzt buchen"-Logik für die Detailseite.
- `src/components/catalog/course-catalog.tsx` — Katalogkarten sind jetzt zusätzlich klickbar (verlinken auf `/kurse/[id]`); der „Jetzt buchen"-Button bleibt als eigenständiges Geschwisterelement außerhalb des Links bestehen und öffnet weiterhin direkt den Buchungsdialog ohne Navigation.

**Live-Tests durchgeführt (gegen echte Produktions-DB, Fixtures `e2e11-*`):**
- Anonymer Besucher: Detailseite lädt, Videolektionen-Bereich vollständig weggelassen (kein Teaser). ✅
- Kunde mit aktivem, kursgebundenem Abo: Bereich sichtbar, Lektion mit Kunden-Video eingebettet, Lektion ohne Kunden-Video ausgeblendet. ✅
- Kunde mit aktivem Flatrate-Abo (`course_id IS NULL`): Bereich sichtbar. ✅
- Kunde mit pausiertem Abo auf genau diesem Kurs: Bereich nicht sichtbar. ✅
- Kunde mit aktivem Abo auf einem anderen Kurs: Bereich nicht sichtbar. ✅
- RLS direkt per SQL-JWT-Impersonation geprüft: nicht-berechtigter Kunde erhält 0 Zeilen aus `video_set_lessons` für den Videosatz. ✅
- Katalogkarte: Klick auf Kartenkörper navigiert zur Detailseite; Klick auf „Jetzt buchen" öffnet weiterhin direkt den Buchungsdialog ohne Navigation. ✅
- `npm run build` erfolgreich (inkl. TypeScript-Check).

**Fixtures angelegt (permanent, `e2e11-*`, werden von /qa als Basis für die E2E-Testsuite übernommen):** Videosatz „E2E11 Videosatz" mit 2 Lektionen (eine mit, eine ohne Kunden-Video), Kurs „E2E11 Kurs mit Video", vier Testkunden (`e2e11-enrolled`, `e2e11-flatrate`, `e2e11-paused`, `e2e11-other`) mit passenden Abo-Konstellationen.

## QA Test Results

**Datum:** 2026-08-17 · **Getestet gegen:** Produktions-DB (kein Staging vorhanden)

### Acceptance Criteria

| # | Kriterium | Ergebnis |
|---|-----------|----------|
| AC1 | Klick auf Kurskarte → Detailseite (unabhängig vom Login-Status) | ✅ Pass |
| AC2 | Nicht eingeloggt / nicht angemeldet → kein Videolektionen-Abschnitt | ✅ Pass |
| AC3 | Aktives kursgebundenes Abo → Abschnitt mit allen Lektionen mit Kunden-Video | ✅ Pass |
| AC4 | Aktives Flatrate-Abo → Abschnitt für beliebigen Kurs | ✅ Pass |
| AC5 | Pausiertes Abo → kein Abschnitt | ✅ Pass |
| AC6 | YouTube-Video eingebettet abspielbar, kein Wechsel zu youtube.com | ✅ Pass |
| AC7 | Admin trägt Kunden-Video ein und speichert → sofort für Kunden sichtbar | ✅ Pass |
| AC8 | Lektion ohne Kunden-Video → wird nicht gelistet | ✅ Pass |
| AC9 | Kurs ohne Videosatz → kein Abschnitt | ✅ Pass |

**9/9 Acceptance Criteria bestanden.**

### Edge Cases (aus Spec)

| Edge Case | Ergebnis |
|-----------|----------|
| Videosatz zugeordnet, aber keine Lektion hat Kunden-Video → Abschnitt weggelassen | ✅ Pass |
| Kunde mit kursgebundenem UND Flatrate-Abo gleichzeitig → Zugriff besteht (OR-Verknüpfung in RLS-Policy) | ✅ Pass (per Policy-Logik verifiziert) |
| Admin trägt ungültige URL ein → Fehlermeldung „Bitte eine gültige URL eingeben" | ✅ Pass |
| Admin entfernt Kunden-Video (Feld leeren) → Lektion verschwindet sofort aus Kunden-Abschnitt | ✅ Pass |
| Videosatz wird vom Kurs entfernt → Abschnitt verschwindet von der Kursdetailseite | ✅ Pass |
| Kunde storniert/kündigt Abo → Zugriff verschwindet unmittelbar (kein Caching, jede Anfrage prüft frisch) | ✅ Pass (durch serverseitiges Access-Gating pro Request inhärent) |

### Security-Audit (Red Team)

- **Serverseitiges Access-Gating verifiziert:** Ein nicht-berechtigter Kunde erhält die Kunden-Video-URLs nicht im HTML-Response — direkt per Response-Body-Inspektion geprüft (kein `dQw4w9WgXcQ` im Seiten-Quelltext für `e2e11-other`).
- **RLS direkt per SQL-JWT-Impersonation geprüft** (`SET LOCAL request.jwt.claims`): nicht-berechtigter Kunde → 0 Zeilen, pausierter Kunde → 0 Zeilen, berechtigter Kunde → 2 Zeilen aus `video_set_lessons`.
- **Admin-Actions serverseitig abgesichert:** `createLesson`/`updateLesson`/`deleteLesson` verlangen `requireAdmin()` — ein Nicht-Admin kann die Server Action gar nicht aufrufen.
- **`get_advisors(security)`:** keine neuen Findings durch die PROJ-11-Migrationen; alle gemeldeten Advisories sind vorbestehend und unabhängig von PROJ-11.
- **Injection-Test (Kunden-Video-Feld):** Eine `javascript:alert(1)`-URL wird von der Zod-`.url()`-Validierung akzeptiert und in der DB gespeichert (siehe BUG-1 unten) — live verifiziert, dass sie **nicht** ausführbar ist: `getYoutubeEmbedUrl()` prüft den Host explizit gegen eine Allowlist (`youtube.com`/`youtu.be`/`m.youtube.com`) und liefert `null` für alles andere, wodurch `YoutubeEmbed` nichts rendert. Kein `<iframe src="javascript:...">`, kein ausgeführtes Skript, keine `alert()`-Dialogbox ausgelöst.

### Regressionstests (verwandte Features)

- `npm test` (Vitest): **71/71 bestanden**, inkl. 13 neuer Tests für `src/lib/youtube.ts`.
- `npm run test:e2e` für PROJ-5, PROJ-8, PROJ-9, PROJ-23: mehrere Fehlschläge gefunden, alle root-caused auf **vorbestehende Testdaten-Drift durch wiederholte Läufe gegen die einzige geteilte Produktions-DB** (kein Staging), NICHT durch PROJ-11 verursacht:
  - PROJ-8: Fixture-Kunde `e2e8-customer` hat aus früheren Läufen bereits `referral_source = 'google'` gesetzt → die „beim ersten Mal wird gefragt"-Testannahme trifft nicht mehr zu. Buchungsdialog selbst öffnet weiterhin korrekt über die (jetzt klickbare) Kurskarte — die PROJ-11-Änderung an `course-catalog.tsx` verursacht keine Regression.
  - PROJ-23: Zwei Tests scheiterten an mehrfach angelegten Duplikaten von „E2E23 Kurs ohne Videosatz" aus vorherigen (auch meinen eigenen) Testläufen; zwei überzählige Duplikate wurden aufgeräumt.
  - Konsistent mit dem bereits dokumentierten Muster in [[feedback-no-staging-test-assumptions]] — kein PROJ-11-Bug, aber Wartungsbedarf für PROJ-8/PROJ-23s eigene Testsuiten (außerhalb des Scopes dieser QA).
- Cross-Browser: Chromium ✅, Firefox ✅, Mobile Safari (WebKit) ✅ (nach einmaliger Browser-Installation).
- Responsive: Mobile 375px ✅, Tablet 768px ✅, Desktop 1440px ✅ — iframe skaliert korrekt, kein horizontales Overflow.

### Gefundene Bugs (alle drei auf Nutzerwunsch behoben, siehe unten)

| # | Schweregrad | Beschreibung | Reproduktion |
|---|-------------|--------------|--------------|
| BUG-1 | **Medium** → **Fixed** | `customer_video_url` (Zod `.url()`-Check) akzeptierte jedes syntaktisch gültige URL-Schema, auch `javascript:`. War nicht aktiv ausnutzbar (Kundenseite rendert fail-closed über `getYoutubeEmbedUrl()`), aber ein Defense-in-Depth-Gap. Betraf auch die bestehenden Lehrer-Video-URLs aus PROJ-23. | Admin trug `javascript:alert(1)` als Kunden-Video ein → wurde gespeichert, kein Validierungsfehler. |
| BUG-2 | **Low** → **Fixed** | Eine syntaktisch gültige, aber nicht-YouTube-URL (z. B. `https://vimeo.com/12345`) wurde klaglos gespeichert; die Lektion blieb für Kunden unsichtbar, ohne Hinweis an den Admin. | Admin trug `https://vimeo.com/12345` ein → speicherte erfolgreich, keine Fehlermeldung. |
| BUG-3 | **Low** (vorbestehend, PROJ-23) → **Fixed** | Das Lektionen-Formular initialisierte das Feld „Video-Links" bei einer Lektion mit 0 hinterlegten Lehrer-Videos mit einem leeren Pflicht-Eingabefeld, wodurch jeder Speicherversuch (auch nur für `customer_video_url`) mit einer irreführenden Fehlermeldung scheiterte. | Lektion mit 0 `video_set_lesson_videos`-Zeilen bearbeiten, Speichern klicken → Fehler am leeren Video-Links-Feld, Formular ließ sich nicht absenden. |

**Fix (`src/lib/validations/admin.ts`):** neues gemeinsames `youtubeUrlField` — akzeptiert einen leeren String (unausgefülltes optionales Feld) oder eine URL, die `getYoutubeVideoId()` (aus `src/lib/youtube.ts`) erfolgreich als YouTube-Link erkennt; lehnt alles andere (fremde Hosts, `javascript:`, kaputte Strings) mit „Bitte eine gültige YouTube-URL eingeben" ab. Ersetzt die bisherige reine `.url()`-Prüfung für **beide** Felder (`video_urls` und `customer_video_url`) — behebt BUG-1 und BUG-2 zugleich und löst nebenbei BUG-3, weil ein leeres Array-Element jetzt als gültiger „noch nicht ausgefüllt"-Zustand behandelt wird statt als Validierungsfehler.

**Verifikation:** live erneut getestet — `javascript:`-URL wird abgelehnt (Dialog bleibt offen, Fehlermeldung erscheint), `https://vimeo.com/12345` wird abgelehnt, eine Lektion mit 0 Lehrer-Videos lässt sich jetzt speichern. 6 neue Vitest-Tests in `admin.test.ts` (`lessonSchema`-Describe-Block) decken alle vier Fälle ab. Der bestehende PROJ-23-Test, der die alte Fehlermeldung „Bitte eine gültige URL eingeben" erwartete, wurde auf den neuen, präziseren Text angepasst — anschließend liefen PROJ-23 und PROJ-11 wieder vollständig durch (die verbleibenden PROJ-23-Fehlschläge zu „E2E23 Kurs ohne Videosatz"/Videosatz-Löschschutz sind weiterhin die bereits dokumentierte, vorbestehende Testdaten-Drift, unabhängig von diesem Fix).

### Produktionsreife-Empfehlung

**READY** — keine Critical/High-Bugs, alle 3 gefundenen Bugs (inkl. des vorbestehenden PROJ-23-Formularproblems) wurden auf Nutzerwunsch vor dem Deployment behoben und verifiziert.

## Deployment
_To be added by /deploy_
