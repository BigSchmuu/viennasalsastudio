# PROJ-92: Ein Druck darf nicht ins Nichts gehen

## Status: Deployed
**Created:** 2026-10-24
**Last Updated:** 2026-10-24

## Dependencies
- Berührt: PROJ-2 (Auth & Kundenprofil) — die Formulare
- Berührt: PROJ-73 (Passwort selbst ändern) — dasselbe Muster
- Nutzt: `lib/auth/fehler.ts` (PROJ-43) — Schlüssel statt fertiger Sätze

## Anlass

Aus Sentry, 2026-10-23, **111 Ereignisse**: `TypeError: Load failed` auf `/login`,
Mobile Safari auf dem iPhone. Die Kette:

1. Ein Kunde klickt auf `/en/kurse/…` den Buchungsknopf, wird zur Anmeldung geschickt.
2. Er tippt Mail und Passwort und drückt „Log in".
3. Der POST der Server-Action geht hinaus und kommt mit **200** zurück — aber der
   Antwortstrom bricht beim Lesen ab. Safari nennt das `Load failed`. Auf einem Mobilgerät
   passiert das regelmäßig: Wechsel von WLAN auf Mobilfunk, gesperrter Bildschirm,
   App-Wechsel.
4. `signIn()` wirft damit. Im Formular steht `try` … `finally`, **kein `catch`**.
5. Das Formular hat `action={absenden}`. React 19 reicht einen Fehler aus einer
   Form-Action an die nächste Fehlergrenze weiter — und die zeigt die Fehlerseite.

Der Kunde wollte einen Kurs buchen und bekam einen Fehlerbildschirm. Belegt ist das durch
`Handled: yes` mit `mechanism: generic` am Event: Wir melden an genau zwei Stellen selbst
an Sentry, und beide sind Fehlergrenzen (`error.tsx`, `global-error.tsx`).

**Kein Formular im Projekt fängt eine gescheiterte Anfrage.** Acht Dateien, alle mit
`try`/`finally` ohne `catch`: Anmelden, Registrieren, Passwort vergessen, Passwort
zurücksetzen, Code-Eingabe der Zwei-Faktor-Anmeldung, Profil, Abmelden und das Einrichten
der zweiten Stufe. Je nach Weg endet das in der Fehlerseite oder in einem Knopf, der
einfach wieder normal aussieht — als hätte man nicht gedrückt.

## User Stories

- Als Kunde möchte ich nach einem Druck wissen, woran ich bin — auch wenn die Verbindung
  weg war.
- Als Kunde möchte ich es gleich nochmal versuchen können, ohne meine Eingaben neu zu
  tippen.
- Als Kunde möchte ich bei einem Verbindungsabbruch nicht auf einer Fehlerseite landen,
  von der aus ich den Weg zurück suchen muss.
- Als Betreiber möchte ich in Sentry erkennen, ob ein Abbruch den Kunden getroffen hat
  oder im Hintergrund blieb.

## Out of Scope

- **Ein Knopf „Nochmal versuchen".** Der Absende-Knopf steht direkt darunter und ist nach
  dem Fehler wieder frei. Ein zweiter Knopf daneben wäre dieselbe Handlung zweimal.
- **Automatisches Wiederholen.** Bei einer Anmeldung heißt „nochmal" ein zweiter
  Anmeldeversuch — das entscheidet der Kunde, nicht die Seite.
- **Offline-Erkennung** (`navigator.onLine`, ein Banner „keine Verbindung"). Eigene
  Baustelle; hier geht es um den einzelnen abgebrochenen Vorgang.
- **Der Sentry-Filter.** Welche Fehlerklassen aus dem Postfach fliegen, wird getrennt
  entschieden — erst wenn klar ist, was echt ist.
- **`Sentry.setUser`.** Würde beantworten, wie viele Personen ein Fehler trifft (heute
  steht dort strukturell „0 users"). Datenschutzfrage, eigene Entscheidung.
- **Die `Select`-Warnung** aus derselben Sentry-Spur (`uncontrolled to controlled`, zehn
  Stellen). Reine Korrektur ohne Produktentscheidung, läuft als eigener Commit.

## Acceptance Criteria

- [ ] Angenommen die Verbindung bricht beim Absenden der Anmeldung ab, wenn der Kunde „Log
      in" gedrückt hat, dann steht im Formular „Die Verbindung ist abgebrochen. Bitte
      versuch es noch einmal." — und **keine** Fehlerseite.
- [ ] Angenommen derselbe Fall, dann stehen E-Mail und Passwort noch in den Feldern.
- [ ] Angenommen derselbe Fall, dann ist der Absende-Knopf wieder bedienbar.
- [ ] Angenommen die Seite ist auf Englisch, dann erscheint die Meldung auf Englisch.
- [ ] Angenommen die Verbindung bricht beim Registrieren, beim Passwort-vergessen, beim
      Zurücksetzen, bei der Code-Eingabe oder im Profil ab, dann gilt dasselbe.
- [ ] Angenommen die Anfrage kommt durch und die Antwort ist ein Fachfehler (falsches
      Passwort, Limit erreicht), dann bleibt die bisherige Meldung — unverändert.
- [ ] Angenommen der Abmeldeknopf scheitert, dann bleibt der Kunde angemeldet und sieht
      das, statt in einem Zustand zwischen beidem zu landen.

## Edge Cases

- **Der Abbruch nach erfolgreichem Schreiben.** Die Anmeldung kann serverseitig geglückt
  sein, obwohl die Antwort nicht ankam — das Sitzungs-Cookie steht dann schon. „Nochmal"
  führt dann einfach zum Ziel. Die Meldung behauptet deshalb nicht, dass es *nicht*
  geklappt hat, sondern dass die Verbindung abbrach.
- **Mehrfaches Drücken.** Zwei Anmeldeversuche hintereinander sind unkritisch; beim
  Registrieren fängt das Supabase-Limit (`over_email_send_rate_limit`) es ab, und diese
  Meldung existiert schon.
- **Fehler vor der Hydration.** Dann läuft der `action`-Weg und nicht `onSubmit`. Der
  `catch` sitzt deshalb in der gemeinsamen Funktion, nicht im Submit-Handler — sonst
  bliebe genau der Weg ungeschützt, auf dem der gemeldete Fehler entstand.
- **Ein Fehler, der kein Netzfehler ist** (ein echter Programmfehler im Formular). Der
  soll weiterhin zur Fehlergrenze und nach Sentry — gefangen wird die Anfrage, nicht
  alles.

## Decision Log

### Product Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| Eine Meldung im Formular statt der Fehlerseite | Der Kunde ist mitten in einem Vorgang. Die Fehlerseite nimmt ihm den Zusammenhang und seine Eingaben. | 2026-10-24 |
| Ein Satz für alle acht Formulare | „Die Verbindung ist abgebrochen" ist die ganze Auskunft, die wir haben. Acht Varianten desselben Satzes wären acht Stellen zum Pflegen. | 2026-10-24 |
| Die Meldung sagt nicht „es hat nicht geklappt" | Es kann geklappt haben — die Antwort fehlt, nicht die Wirkung. Siehe Edge Cases. | 2026-10-24 |
| Kein zweiter Knopf, kein automatisches Wiederholen | Der Absende-Knopf ist frei und steht darunter. Wiederholen bei einer Anmeldung ist eine Entscheidung des Kunden. | 2026-10-24 |

### Technical Decisions

| Entscheidung | Begründung | Datum |
|---|---|---|
| Neuer Schlüssel `errConnectionLost` in `AuthFehler` | Die Infrastruktur steht (PROJ-43): Schlüssel statt Satz, `fehlertext()` übersetzt in die Sprache der Seite. Ein fertiger deutscher Satz stünde sonst wieder auf der englischen Seite. | 2026-10-24 |
| Der `catch` sitzt in der gemeinsamen Absende-Funktion | Sie bedient beide Auslöser, `onSubmit` **und** `action`. Im Submit-Handler allein bliebe der `action`-Weg offen — und genau der hat den Fehler vom 2026-10-23 erzeugt. | 2026-10-24 |
| Gefangen wird nur um die Anfrage herum | Ein Programmfehler im Formular soll weiter zur Fehlergrenze und nach Sentry. Ein `catch` um alles verschluckte künftige echte Fehler. | 2026-10-24 |
| Das Profil nutzt den Namensraum `profile` | Dort liegen seine übrigen Texte. Der Satz kommt in beide Namensräume, statt eine Komponente zwei Namensräume lesen zu lassen. | 2026-10-24 |

## Open Questions

- [ ] Soll `Sentry.setUser({ id })` dazukommen, damit „wie viele Kunden betrifft das"
      beantwortbar wird? Pseudonyme ID, keine Mailadresse — aber eine Datenschutzfrage,
      die der Betreiber entscheidet.

## Umsetzung (2026-10-24)

**Der Kern:** [verbindung.ts](../src/lib/auth/verbindung.ts) mit `mitVerbindung()`. Es
ruft die Aktion auf und gibt einen Abbruch als `{ error: "errConnectionLost" }` zurück —
genau die Gestalt, die die Formulare schon behandeln. Die Meldung erscheint damit dort, wo
die anderen Fehler auch erscheinen, ohne dass ein Formular eine neue Anzeige braucht.

Unterschieden wird an `fehler instanceof TypeError`: Ein gescheiterter `fetch` ist in jedem
Browser ein TypeError („Failed to fetch", „Load failed", „NetworkError…"), ein Fehler
**aus** der Server-Action ein gewöhnlicher `Error` mit Digest. Der fliegt weiter zur
Fehlergrenze und nach Sentry — ein `catch`, das alles fängt, hätte künftige echte
Programmfehler als „Verbindung abgebrochen" angezeigt und aus dem Postfach genommen.

**Eingebaut** in acht Stellen: Anmelden, Registrieren, Passwort vergessen, Passwort
zurücksetzen, Profil, die beiden Formulare der Zwei-Faktor-Anmeldung (dort um
`geraetMerken` — scheitert nur das Merken, ist die Prüfung dennoch bestanden und es geht
weiter) und das Abmelden. Letzteres ist das einzige ohne eigene Anzeigefläche und bekommt
eine Einblendung (`sonner`): Vorher wurde der Knopf nach einem Abbruch einfach wieder
normal, und der Kunde blieb angemeldet, ohne es zu erfahren.

**Der Satz** als `auth.errConnectionLost` (DE/EN) über die bestehende Mechanik aus PROJ-43.
Das Profil gibt fertige Sätze zurück statt Schlüssel, deshalb dort der einzige Fall, der
von Hand übersetzt wird (`profile.connectionLost`).

**Geprüft:** 6 Vitest-Fälle für `mitVerbindung` (Ergebnis durchgeben, Fachfehler
durchgeben, Abbruch in ein Ergebnis wandeln, Programmfehler weiterfliegen lassen) und
4 Browserprüfungen in
[PROJ-92-verbindungsabbruch.spec.ts](../tests/PROJ-92-verbindungsabbruch.spec.ts), die den
Abbruch mit `route.abort()` nachstellen — dieselbe Wirkung im Browser wie der
Verbindungswechsel auf dem iPhone. Sie brauchen kein Testkonto, weil die Anfrage den Server
nie erreicht, und hängen damit an keiner Fixture.

**Gegenprobe gemacht:** Mit zurückgedrehtem Aufruf ist die erste Browserprüfung rot — die
Meldung bleibt aus. Dabei zeigte sich ein Unterschied der Umgebungen: Im
Entwicklungsmodus passiert schlicht nichts (Formular bleibt, Knopf wird wieder frei),
während in Produktion die Fehlergrenze griff — belegt durch `handled: yes` mit
`mechanism: generic` am Sentry-Event, denn wir melden nur an zwei Stellen selbst, und
beide sind Fehlergrenzen.

### Daneben, als eigene Korrekturen

- **Zehn `Select`-Stellen** von `value={x || undefined}` auf `?? ""`. Bei leerem Feld war
  `value` `undefined` und das Feld unkontrolliert, nach der ersten Wahl kontrolliert —
  React warnt darüber zu Recht (dieselbe Sentry-Spur, 2026-10-23). Radix zeigt beim leeren
  String denselben Platzhalter. Einmal im Kundenprofil, neunmal in der Verwaltung.
- **Ein Filter in Sentry** gegen fremde DOM-Eingriffe: `NotFoundError: removeChild` entsteht,
  wenn Google Translate Textknoten in `<font>`-Hüllen wickelt und React beim Seitenwechsel
  ins Leere räumt. Bewusst eng gefasst — nur diese Fehler, und nur während ein Übersetzer
  tatsächlich am Werk ist (`html.translated-ltr`). Ein `removeChild`-Fehler ohne Übersetzer
  wäre unserer und kommt weiterhin an.

## Deployment

- **Ausgeliefert:** 2026-10-24
- **Produktion:** https://app.viennasalsastudio.at
- **Commit:** `aa285b1`
- **Migration:** keine — reine Browserseite.
- **Nachgesehen:** Vercel-Deployment `Ready` (1 min); Startseite, `/login` und `/en/login`
  200, `/profil` 307 auf die Anmeldung.

### Für den Betrieb

- Bricht die Verbindung beim Absenden ab, steht die Meldung jetzt **im Formular**, die
  Eingaben bleiben stehen, und der Knopf ist wieder frei. Keine Fehlerseite.
- Die Meldung sagt bewusst nicht, dass es nicht geklappt hat: Der Vorgang kann serverseitig
  geglückt sein, nur die Antwort fehlte. Nochmal drücken führt dann einfach zum Ziel.
- **Was in Sentry zu erwarten ist:** `TypeError: Load failed` auf `/login` sollte als Fehler
  verschwinden — die Abbrüche passieren weiter, werden aber gefangen. Bleibt die Zahl hoch,
  war die Diagnose falsch und es gehört nochmal angesehen.
- `NotFoundError: removeChild` von Google Translate kommt nicht mehr an, solange ein
  Übersetzer aktiv ist. Ohne Übersetzer kommt ein solcher Fehler weiterhin — der wäre dann
  unserer.
