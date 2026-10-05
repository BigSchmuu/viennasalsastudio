# PROJ-73: Passwort selbst ändern

## Status: Deployed
**Created:** 2026-10-05
**Last Updated:** 2026-10-05

## Dependencies
- Requires: PROJ-2 (Auth & Kundenprofil) — das Profil ist der Ort für den neuen Abschnitt
- Requires: PROJ-58 (Zwei-Faktor-Anmeldung) — die Ursache, warum der Mail-Weg für Admins scheitert
- Berührt: PROJ-43 (Sprachebene) — der Abschnitt steht im zweisprachigen Kundenbereich

## Anlass

Meldung des Betreibers: Ein Verwaltungskonto kann sein Passwort nicht ändern. Der Weg über
„Passwort vergessen" endet nicht am Formular, sondern im Dashboard.

Der Grund liegt nicht am Zurücksetzen selbst, sondern an der Weiche davor. Der Link aus der Mail
führt auf `/passwort-zuruecksetzen`, und diese Seite liegt im Kundenbereich. Dessen Layout schickt
seit PROJ-58 jedes Verwaltungskonto ohne bestätigte zweite Stufe zuerst auf die Code-Seite — und die
leitet nach bestandenem Code **fest auf `/admin`**. Das ursprüngliche Ziel merkt sich niemand. Der
Admin bestätigt also brav seinen Code, landet im Dashboard und hat dabei den Einmal-Link verbraucht.

Dazu kommt eine Lücke, die alle betrifft: Ein angemeldeter Nutzer kann sein Passwort überhaupt
nicht ändern. Es gibt nur den Umweg „abmelden → Passwort vergessen → Mail abwarten → Link klicken".
Für ein Konto, dessen Passwort man einfach wechseln will, ist das viel Umstand — und für ein
Verwaltungskonto führt er, siehe oben, ins Nichts.

## User Stories

- Als Kunde möchte ich mein Passwort im Profil ändern können, ohne mir erst eine Mail schicken zu
  lassen.
- Als Mitarbeiter möchte ich mein Passwort ändern können, obwohl an meinem Konto die zweite Stufe
  hängt.
- Als Mitarbeiter, der sein Passwort wirklich vergessen hat, möchte ich den Mail-Link benutzen und
  nach der Code-Eingabe wieder beim Passwortformular landen.
- Als Kontoinhaber möchte ich, dass eine Passwortänderung fremde Geräte hinauswirft — sonst nützt
  sie nichts, wenn jemand mitgelesen hat.
- Als Betreiber möchte ich Passwörter nicht im Supabase-Dashboard setzen müssen.

## Out of Scope

- **Bestätigungsmail „Dein Passwort wurde geändert"** — braucht eine neue Benachrichtigungsart samt
  Migration in Test und Produktion, eine Vorlage in der Verwaltung und den Versandweg. Bewusste
  Entscheidung des Betreibers (2026-10-05): erst das Ändern selbst, die Mail später als eigener
  Punkt.
- **Passwörter fremder Konten setzen** — die Verwaltung schickt weiterhin einen Reset-Link; wer ein
  Passwort direkt setzen muss, tut das im Supabase-Dashboard.
- **Neue Passwortregeln oder eine Stärkeanzeige** — es gilt unverändert die Regel aus
  `validations/auth.ts` (acht Zeichen, Klein-, Großbuchstabe, Ziffer).
- **Zweite Stufe zurücksetzen oder neu einrichten** — steht schon im Abschnitt „Anmeldesicherheit"
  und in der Kundenverwaltung (PROJ-58).
- **E-Mail-Adresse ändern**, Passkeys, Anmeldung über Google o. Ä.
- **Sitzungsübersicht** („diese Geräte sind angemeldet") — abgemeldet wird pauschal, aufgelistet
  wird nichts.

## Acceptance Criteria

- [ ] Angenommen ein Kunde ist angemeldet, wenn er im Profil unter „Einstellungen" den Abschnitt
      „Passwort ändern" öffnet, dann sieht er drei Felder: aktuelles Passwort, neues Passwort,
      Wiederholung.
- [ ] Angenommen alle drei Felder sind richtig gefüllt, wenn er speichert, dann bestätigt die Seite
      die Änderung, die Felder sind leer und er ist weiterhin angemeldet.
- [ ] Angenommen das aktuelle Passwort ist falsch, wenn er speichert, dann erscheint ein Hinweis
      genau dazu und das Passwort bleibt unverändert.
- [ ] Angenommen das neue Passwort erfüllt die Regel nicht, wenn er speichert, dann erscheint
      derselbe Hinweis wie beim Zurücksetzen und es wird nichts geändert.
- [ ] Angenommen neues Passwort und Wiederholung stimmen nicht überein, wenn er speichert, dann
      erscheint ein Hinweis dazu und es wird nichts geändert.
- [ ] Angenommen die Änderung war erfolgreich, dann sind alle anderen Anmeldungen desselben Kontos
      beendet — das eigene Gerät bleibt angemeldet.
- [ ] Angenommen ein Verwaltungskonto mit bestätigter zweiter Stufe ist angemeldet, wenn es den
      Abschnitt benutzt, dann funktioniert er genauso und die zweite Stufe muss dafür nicht erneut
      bestätigt werden.
- [ ] Angenommen ein englischsprachiger Kunde ist im Profil, dann sind Überschrift, Felder, Knopf
      und alle Meldungen englisch.
- [ ] Angenommen ein Verwaltungskonto fordert einen Reset-Link an und klickt ihn an, wenn die zweite
      Stufe in dieser Anmeldung noch zu bestätigen ist, dann steht nach der Code-Eingabe das
      Passwortformular da — nicht das Dashboard.
- [ ] Angenommen ein Verwaltungskonto kommt ohne gemerktes Ziel auf die Code-Seite, wenn es den Code
      bestätigt, dann geht es wie bisher ins Dashboard.
- [ ] Angenommen als Ziel steht eine fremde Adresse im Aufruf, wenn der Code bestätigt wird, dann
      wird das Ziel verworfen und es geht ins Dashboard.
- [ ] Angenommen niemand ist angemeldet, wenn die Profilseite aufgerufen wird, dann ist auch das
      Passwortformular nicht erreichbar — es gilt der bestehende Schutz von `/profil`.

## Edge Cases

- **Neues Passwort gleich dem alten**: Supabase lehnt das ab. Die Meldung muss sagen, was gemeint
  ist („Das neue Passwort muss sich vom alten unterscheiden"), nicht den englischen Fehlercode.
- **Prüfung des aktuellen Passworts darf die laufende Anmeldung nicht ersetzen.** Wird dafür eine
  gewöhnliche Anmeldung durchgeführt, bekommt das Konto eine frische Sitzung auf der *ersten* Stufe
  — ein Admin flöge damit sofort auf die Code-Seite, mitten im Speichern. Die Prüfung muss die
  bestehenden Cookies unangetastet lassen.
- **Zu viele Versuche**: Supabase bremst. Dann erscheint ein eigener Satz („Bitte warte einen
  Moment"), nicht „Passwort falsch".
- **Sitzung abgelaufen, während das Formular offen stand**: Hinweis, dass eine neue Anmeldung nötig
  ist; das eingegebene neue Passwort wird nicht heimlich gespeichert.
- **Admin ohne eingerichtete zweite Stufe klickt den Reset-Link**: Er landet auf der Einrichtung.
  Das gemerkte Ziel wird auch über diesen Weg weitergereicht; geht das nicht, gilt das Dashboard.
- **Zwei Tabs**: Im zweiten Tab ist nach der Änderung das alte Passwort hinterlegt — die Sitzung
  dort bleibt gültig (es ist dasselbe Gerät). Nur andere Geräte sind betroffen.
- **Lehrerkonten**: Sie haben dieselbe zweite Stufe wie Admins (PROJ-49) und denselben Abschnitt im
  Profil. Für sie gilt alles unverändert.

## Technical Requirements

- Security: Die Änderung erfordert das aktuelle Passwort. Serverseitige Prüfung, nicht nur im
  Browser. Keine Passwörter in Logs, keine Fehlermeldung, die ein fremdes Konto verrät.
- Security: Das gemerkte Ziel nach der Code-Eingabe ist ein Pfad auf dieser Seite, keine fremde
  Adresse (Schutz vor offener Weiterleitung).
- Browser Support: wie der Rest der App (Chrome, Firefox, Safari, iOS).

## Open Questions
- Keine offen.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Abschnitt im Profil, nicht eigene Admin-Seite | Das Profil trägt schon „Anmeldesicherheit"; Admins benutzen es ohnehin für ihre eigenen Rechnungen. Ein zweiter Ort für dieselbe Sache wäre nur Suchaufwand. | 2026-10-05 |
| Für alle Konten, nicht nur für die Verwaltung | Der Umweg über die Mail ist auch für Kunden unnötig, wenn sie angemeldet sind. Kosten: die Texte brauchen eine englische Fassung. | 2026-10-05 |
| Aktuelles Passwort ist Pflicht | Ein unbeaufsichtigter Rechner soll nicht genügen, um den Inhaber aus seinem Konto auszusperren. | 2026-10-05 |
| Andere Geräte werden abgemeldet | Eine Passwortänderung aus Sorge („jemand hat mitgelesen") muss diesen jemand hinauswerfen, sonst ist sie wirkungslos. Preis: Das eigene zweite Gerät verlangt eine neue Anmeldung. | 2026-10-05 |
| Keine Bestätigungsmail in dieser Stufe | Neue Benachrichtigungsart heißt Migration in Test und Produktion plus Vorlage; das steht in keinem Verhältnis zum Rest dieser Änderung. | 2026-10-05 |
| Der Mail-Weg wird mitrepariert | Ein Formular im Profil hilft nur, wer sein Passwort noch kennt. Wer es vergessen hat, braucht den Link — und der ist für Verwaltungskonten derzeit wertlos. | 2026-10-05 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Prüfung des aktuellen Passworts über eine cookie-freie Zweitverbindung | Eine gewöhnliche Anmeldung überschreibt die Sitzungscookies und wirft ein Verwaltungskonto auf die erste Stufe zurück — es landete mitten im Speichern auf der Code-Seite. | 2026-10-05 |
| Reihenfolge: prüfen → setzen → andere abmelden | Das Abmelden „anderer" räumt am Ende auch die Sitzung weg, die die Prüfung angelegt hat. Umgekehrt bliebe sie stehen. | 2026-10-05 |
| Ein Fehler beim Abmelden anderer Geräte lässt die Aktion erfolgreich sein | Das Passwort ist dann schon geändert. „Fehlgeschlagen" wäre eine Lüge, die zum zweiten Versuch verleitet. | 2026-10-05 |
| Keine Migration, kein neues Feld | Passwörter liegen ausschließlich bei Supabase; die App hält nichts davon. | 2026-10-05 |
| Das Ziel wird beim Einlösen des Links angehängt, nicht im Layout bestimmt | Ein Layout kennt in Next die aufgerufene Adresse nicht. Das Einlösen kennt sie. | 2026-10-05 |
| Das Ziel läuft durch `safeRedirectPath` | Schutz vor offener Weiterleitung — dieselbe Funktion wie bei Login und Mail-Link, kein zweiter Mechanismus. | 2026-10-05 |
| Fehlergründe als Schlüssel, nicht als Satz | Sonst stünde auf der englischen Seite Deutsch; die Lektion von 2026-09-13 (`lib/auth/fehler.ts`). | 2026-10-05 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

Zwei Teile an zwei Stellen. Keine neue Tabelle, keine neue Spalte, **keine Migration** — Passwörter
liegen ausschließlich bei Supabase, die App sieht sie nie und speichert nichts davon.

### Teil 1: Der Abschnitt im Profil

```
Profil → Gruppe „Einstellungen"
+-- Benachrichtigungen            (bestehend)
+-- Gasttänzer                    (bestehend)
+-- Passwort ändern               (NEU)
|   +-- Feld: aktuelles Passwort
|   +-- Feld: neues Passwort      (mit dem bekannten Hinweis zur Regel)
|   +-- Feld: Wiederholung
|   +-- Knopf „Passwort speichern"
|   +-- Meldung: Erfolg oder der Grund, warum es nicht ging
+-- Anmeldesicherheit             (bestehend, nur Verwaltungskonten)
```

Was beim Speichern passiert, in Worten:

1. **Eingaben prüfen** — dieselbe Regel wie beim Zurücksetzen (acht Zeichen, Klein-, Großbuchstabe,
   Ziffer), dazu „die beiden neuen Felder müssen übereinstimmen".
2. **Aktuelles Passwort gegenprüfen** — über eine *eigene, cookie-freie Verbindung* zu Supabase.
   Das ist der heikelste Punkt des ganzen Vorhabens: Eine gewöhnliche Anmeldung würde die
   Sitzungscookies überschreiben und ein Verwaltungskonto damit auf die erste Stufe zurückwerfen.
   Es flöge mitten im Speichern auf die Code-Seite — und hätte danach ein unverändertes Passwort.
3. **Passwort setzen.**
4. **Andere Anmeldungen beenden** — nur die anderen, das eigene Gerät bleibt drin.
5. **Erfolg melden**, Felder leeren.

Scheitert Schritt 4, gilt die Änderung trotzdem als erfolgreich: Das Passwort ist zu diesem
Zeitpunkt schon neu, „fehlgeschlagen" wäre die falsche Auskunft. Der Fehler landet im Log.

Die Fehlergründe kommen als Schlüssel zurück und werden in der Sprache der Seite angezeigt — wie
schon bei Anmeldung und Zurücksetzen (`lib/auth/fehler.ts`). Neu sind drei Fälle: „aktuelles
Passwort stimmt nicht", „neues gleicht dem alten", „bitte neu anmelden".

### Teil 2: Das Ziel über die zweite Stufe hinwegretten

Die Stelle, die das Ziel kennt, ist das **Einlösen des Mail-Links** — nicht das Layout des
Kundenbereichs, das heute umleitet: Ein Layout kennt in Next die aufgerufene Adresse gar nicht, es
könnte das Ziel also nicht weitergeben. Beim Einlösen liegt es dagegen als Angabe im Link.

```
Mail-Link  →  /bestaetigen  →  Knopf „Neues Passwort festlegen"
                                 |
                                 +-- Kundenkonto        → direkt zum Formular (wie bisher)
                                 +-- Verwaltungskonto   → Code-Seite MIT gemerktem Ziel
                                                            → nach dem Code zum Formular
```

Code-Seite und Einrichtungsseite nehmen das Ziel als Angabe in der Adresse an und lassen es durch
dieselbe Schutzfunktion laufen, die Login und Mail-Link schon benutzen (`safeRedirectPath`): nur
Pfade auf dieser Seite, alles andere wird verworfen. Ohne Ziel bleibt es beim Dashboard.

### Abhängigkeiten

Keine neuen Pakete.

### Hinweis für den Betrieb

Steht im Supabase-Dashboard die Option „Secure password change" (Reauthentication) an, verlangt
Supabase zusätzlich einen per Mail verschickten Code und lehnt das Setzen sonst ab. Die App zeigt
dann einen verständlichen Hinweis statt eines Fehlercodes; gebaut ist der Ablauf für die
Standardeinstellung (aus).


## QA Test Results (2026-10-05)

**Empfehlung: bereit für die Produktion.** Keine Migration.

| | |
|---|---|
| Regeln (Unit) | 29 neu: 11 für die Aktion, 4 für den Umweg, 5 für das Schema, 5 für Fehlertexte und das Ziel, 4 für das Einlösen |
| Browser (E2E) | 6 neu, in Chromium und Mobile Safari grün (12 Läufe) |
| Rückblick | PROJ-2, PROJ-58 und PROJ-49 (Sicherheit) — 47 Prüfungen, alle grün |
| Gesamt | 1061 Unit- und Datenbankprüfungen grün (1 übersprungen) |
| Produktfehler gefunden | 1 (vor der Auslieferung behoben, siehe unten) |

### Was geprüft ist

**Die Aktion** an jeder Abzweigung: Erfolg, falsches aktuelles Passwort, erreichtes Limit (wird
*nicht* als „Passwort falsch" ausgegeben), neues Passwort gleich dem alten, schwaches Passwort,
abgelaufene Sitzung, abweichende Wiederholung, leeres aktuelles Feld. Dazu ausdrücklich: dass die
Prüfung über die cookie-freie Verbindung läuft und die Sitzungsverbindung sich **nie** anmeldet —
das ist der Fehler, der die ganze Sache hätte kippen lassen.

**Der Weg im Browser**: Kunde ändert sein Passwort, meldet sich ab, das alte Passwort wird abgewiesen
und das neue angenommen. Falsches aktuelles Passwort: Meldung erscheint *und* das alte Passwort gilt
anschließend noch (zur Gegenprobe über die Datenbank, nicht nur über die Meldung). Abweichende
Wiederholung. Englische Fassung samt englischer Fehlermeldung vom Server.

**Andere Geräte**: Ein zweiter Browserkontext ist angemeldet; nach der Änderung kommt er nicht mehr
ins Profil, während das eigene Gerät drinbleibt.

**Der gemeldete Fall**, vollständig durchgespielt: ein Verwaltungskonto mit eingerichteter zweiter
Stufe, ein echter Mail-Link (über `generateLink`), Code-Eingabe — und danach steht das
Passwortformular da, nicht das Dashboard. Die Adresse der Code-Seite trägt dabei das gemerkte Ziel.
Zum Abschluss trägt das neue Passwort auch wirklich.

### Der gefundene Fehler

Der Umweg zur Code-Seite verließ sich darauf, dass `redirect` eine Ausnahme wirft, statt es
hinzuschreiben (`if (umweg) pfadRedirect(umweg)` ohne `return`). In der Anwendung ging das gut, aber
der Ablauf hing an einer Eigenschaft, die an dieser Stelle nirgends steht — der Test fiel sofort
darüber. Jetzt steht `return` da, mit einer Zeile Begründung.

### Was offen bleibt

- Die **Bestätigungsmail** ist bewusst nicht dabei (Entscheidung vom 2026-10-05, siehe Out of Scope).
- Steht im Supabase-Dashboard „Secure password change" an, lehnt Supabase das Setzen ab; die App
  zeigt dafür einen verständlichen Hinweis, geprüft ist dieser Pfad aber nur als Fehlertext.


## Deployment

**Produktion:** https://app.viennasalsastudio.at — ausgeliefert am 2026-10-05
**Tag:** `v1.73.0-PROJ-73` (Commit `78e7069`)
**Vercel:** `dpl_…cx6se6a3o`, Zustand Ready, als Produktion aliasiert

**Keine Migration.** Weder Test- noch Produktionsdatenbank mussten angefasst werden — Passwörter und
Sitzungen liegen ausschließlich bei Supabase.

### Nachprüfung von außen

| Adresse | Erwartet | Ergebnis |
|---|---|---|
| `/profil` | 307 auf den Login | ✔ `?redirect=%2Fprofil` |
| `/en/profil` | 307 auf den englischen Login | ✔ `/en/login?redirect=%2Fen%2Fprofil` |
| `/passwort-vergessen` | 200 | ✔ |
| `/sicherheit/code` | 307 auf den Login | ✔ |

Der Abschnitt selbst steht hinter der Anmeldung und ist von außen nicht prüfbar — belegt ist er
durch die sechs E2E-Tests in beiden Browsern, die genau diesen Weg gehen.

### Für den Betrieb

Im Supabase-Dashboard sollte unter Authentication die Option „Secure password change"
(Reauthentication) **aus** bleiben. Steht sie an, verlangt Supabase zusätzlich einen per Mail
verschickten Code; die App zeigt dann einen verständlichen Hinweis, geändert werden kann das
Passwort aber nicht.
