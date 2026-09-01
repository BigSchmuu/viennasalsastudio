# Troubleshooting: Tests & Testumgebung

Sammlung konkreter Probleme, die in diesem Projekt schon einmal Zeit gekostet haben —
mit der Ursache, nicht nur dem Rezept.

## `npx playwright install` hängt (WebKit, 2026-08-23)

**Symptom:** Der Befehl läuft scheinbar endlos. Im Browser-Cache
(`~/Library/Caches/ms-playwright/webkit-<version>/`) liegt nur eine einzige Datei
(`libwebrtc.dylib`, ~16 MB von insgesamt ~286 MB), und sie wächst nicht mehr. Der Prozess
verbraucht praktisch keine CPU. Ein zweiter Versuch scheitert zusätzlich an der Sperre
`~/Library/Caches/ms-playwright/__dirlock`, die der hängende Prozess hält.

**Nicht die Ursache:** das Netz. Ein direkter Abruf vom Playwright-CDN lieferte 9,4 MB/s.

**Tatsächliche Ursache:** Der Download ist bereits **vollständig**. Der Kindprozess
`oopDownloadBrowser` hält ein offenes Handle auf ein fertiges 80-MB-Archiv unter
`/private/var/folders/.../T/playwright-download-*/playwright-download-webkit-*.zip`.
Blockiert ist das **Entpacken**, nicht das Laden. Erkennbar daran, dass der Prozess weder
eine Netzwerkverbindung noch CPU-Last hat:

```bash
lsof -p <PID> -i          # keine Verbindung -> Download ist durch
lsof -p <PID> | grep zip  # zeigt das fertige Archiv
```

**Lösung:** Das bereits geladene Archiv von Hand entpacken.

```bash
# 1. Archiv sichern, BEVOR der Prozess beendet wird (er räumt Temp beim Beenden auf)
cp /private/var/folders/*/T/playwright-download-*/playwright-download-webkit-*.zip /tmp/webkit.zip
unzip -t /tmp/webkit.zip | tail -1      # Unversehrtheit prüfen

# 2. Hängende Prozesse beenden und Sperre entfernen
pkill -f "playwright install"
rm -rf ~/Library/Caches/ms-playwright/__dirlock ~/Library/Caches/ms-playwright/webkit-<version>

# 3. Selbst entpacken und als vollständig markieren
mkdir -p ~/Library/Caches/ms-playwright/webkit-<version>
unzip -q /tmp/webkit.zip -d ~/Library/Caches/ms-playwright/webkit-<version>
touch ~/Library/Caches/ms-playwright/webkit-<version>/INSTALLATION_COMPLETE

# 4. Prüfen
npx playwright test <eine-spec> --project="Mobile Safari"
```

Die Datei `INSTALLATION_COMPLETE` ist nicht optional — ohne sie hält Playwright den Browser
für unvollständig und lädt erneut.

**Nur die konfigurierten Browser installieren.** `playwright.config.ts` nutzt ausschließlich
`chromium` und `Mobile Safari` (WebKit). Ein `npx playwright install` ohne Argument lädt
zusätzlich Firefox und verlängert das Problem unnötig.

## E2E-Tests laufen gegen die Produktiv-Datenbank

Es gibt **keine Staging-Datenbank**. Daraus folgen drei Regeln, die im Projekt mehrfach
teuer verletzt wurden:

1. **Jede Suite stellt ihren Ausgangszustand selbst her** (`test.beforeAll` mit dem
   Service-Role-Schlüssel). Ohne das läuft eine Suite genau einmal grün und danach nie
   wieder, weil sie ihre eigenen Voraussetzungen aufbraucht. Betroffen waren zeitweise
   PROJ-3, 6, 7, 9, 10, 12, 14, 22 und 23.
2. **Niemals einen systemweiten Zustand behaupten** („kein Kunde passt zum Lauf", „dieser
   Wochentag ist leer", „genau 2 Zeilen"). Andere Suiten verändern denselben Datenbestand.
   Entweder relativ messen (Differenz vor/nach) oder die Bedingung für diesen einen Test
   gezielt herstellen und in `finally` zurücksetzen.
3. **Reihenfolge beachten.** Playwright arbeitet die Dateien alphabetisch ab: PROJ-10 läuft
   vor PROJ-7 und PROJ-9. Räumt eine Suite erst an ihrem eigenen Anfang auf, liegen ihre
   Rückstände aus dem Vorlauf noch da, wenn eine früher einsortierte Suite prüft.

## Zeitabhängige Tests

Drei Fallen, die alle schon zugeschlagen haben:

- **Wochenende:** Ein Test pausierte den *nächsten* Freitag, die Seite prüft aber den Freitag
  *dieser* Woche. Montags bis freitags derselbe Tag — samstags und sonntags eine Woche daneben.
- **Mitternacht:** Fixtures, die von „2 Stunden zurück bis 3 Stunden voraus" spannen, passen
  zwischen 21:00 und 02:00 nicht in denselben Kalendertag. PROJ-25 überspringt sich in diesem
  Fenster mit Begründung, statt falsch rot zu sein.
- **Feste Zeitstempel:** Fixture-Termine mit hart verdrahtetem Datum gehen still kaputt, sobald
  sie verstreichen. Termine relativ zu `now` setzen.

## Mobiles Safari (WebKit)

Die Suite läuft in zwei Browsern. WebKit ist dabei nicht nur „langsamer" — er verhält sich
an einigen Stellen anders, und jede dieser Stellen hat schon einmal einen Test gekostet.

- **Die Navigation liegt hinter dem Menü-Knopf.** Die Desktop-Leiste steht zwar im Markup,
  ist aber per CSS ausgeblendet (`hidden md:flex`). Ein Klick darauf läuft in die
  Zeitgrenze, statt zu sagen, was fehlt. Vor dem Zugriff auf Navigationslinks oder den
  Sprachumschalter also erst „Menü öffnen" anklicken — siehe `navBereich()` in
  `PROJ-43-englische-sprachvariante.spec.ts`.
- **Zwei Navigationen gleichzeitig brechen einander ab.** Lädt die Anwendung nach einer
  Aktion selbst nach (Buchung, Ticketkauf, Absage) und navigiert der Test im selben Moment,
  meldet Playwright „interrupted by another navigation". Auf Chromium passiert das fast
  nie. Abhilfe: `gehZu()` in PROJ-8 und PROJ-14 — vor der eigenen Navigation die laufende
  abwarten.
- **Zwischenablage-Rechte gibt es nicht.** `grantPermissions(["clipboard-read",
  "clipboard-write"])` wirft auf WebKit. Sichtbarkeit und Rückmeldung lassen sich trotzdem
  prüfen, nur das Rücklesen nicht.
- **Datei-Downloads gibt es nicht.** iOS öffnet Dateien, statt sie zu speichern; das
  `download`-Ereignis kommt nie. Der CSV-Export ist dort übersprungen.

### Der Hydrations-Konflikt auf /events

Ein Sonderfall, weil er **kein Testproblem ist, sondern ein Fehler der Anwendung**.

`formatDateTime` in `src/lib/formatting.ts` benutzt `toLocaleString("de-AT", …)`. Node und
WebKit sind sich über das Komma nach dem Wochentag nicht einig:

```
Server (Node, ICU 78):  Di., 08.09.2026, 15:38
Browser (WebKit):       Di. 08.09.2026, 15:38
```

React wirft den Teilbaum daraufhin weg und baut ihn neu auf („Hydration failed because the
server rendered text didn't match the client"). Ein Klick in diesem Moment landet auf einem
Element, das gleich darauf ersetzt wird — genau daran scheiterte PROJ-14 AC2.

Der Test wartet deshalb kurz, bevor er klickt. Das ist ein Pflaster: Solange die Ursache
steht, baut jeder Safari-Besucher die Eventliste beim Laden zweimal auf. Behoben wäre sie,
indem das Datum nicht der Landeseinstellung der jeweiligen Engine überlassen, sondern aus
`formatToParts` selbst zusammengesetzt wird — dann liefern beide Seiten dieselbe
Zeichenkette.
