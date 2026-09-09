# PROJ-50: Flatrate für mehrere Kurse

## Status: Planned
**Created:** 2026-09-10
**Last Updated:** 2026-09-10
**Priorität:** P0 (vor Inbetriebnahme)

## Dependencies
- Requires: PROJ-8 (Kursbuchung) — hier entsteht heute die Flatrate-Anfrage
- Requires: PROJ-9 (Abo-Verwaltung) — Pausieren und Kündigen wirken auf die Kursliste
- Requires: PROJ-13 (Lehrer-Ansicht) — die Anwesenheitsliste soll Flatrate-Kunden endlich zeigen
- Requires: PROJ-12 (Warteliste) — Nachrückung muss den neuen Weg nehmen
- Berührt: PROJ-30 (Rollenbalance), PROJ-27 (Vorkenntnisse), PROJ-49 (Geburtstage im Lehrer-Bereich)

## Problem

Eine Flatrate ist heute ein Abo **ohne Kursbezug**: Beim Bestätigen setzt der
Betrieb `subscriptions.course_id` bewusst auf `null`. Das Abo hält damit fest,
*dass* jemand pauschal zahlt — aber nirgends, *welche* Kurse er besucht.

Daraus folgen zwei Dinge, beide am 2026-09-10 im Code und in der Testdatenbank
nachgeprüft:

**1. Doppelte Abbuchung.** Die Sperre „Du bist für diesen Kurs bereits
angemeldet" in `create_regular_course_booking` prüft
`subscriptions.course_id = dieser Kurs`. Bei einer Flatrate ist die Spalte leer,
die Bedingung trifft also nie zu. Der Kunde kann denselben oder einen weiteren
Kurs erneut buchen; beim Bestätigen entsteht ein **zweites Abo mit eigenem
Preis**. Wer drei Kurse besuchen will, zahlt dreimal Flatrate — oder meldet sich
gar nicht erst für alle an.

**2. Der Flatrate-Kunde ist im Kursbetrieb unsichtbar.** Jede Stelle, die fragt
„wer ist in diesem Kurs?", liest `subscriptions.course_id`:

| Stelle | Folge für den Flatrate-Kunden |
|---|---|
| Anwesenheitsliste (`get_course_attendance_roster`) | steht nicht drin; der Lehrer trägt ihn in **jeder** Stunde von Hand nach |
| Kursgrenze (`v_used` in Buchung, Warteliste, Nachrückung) | zählt nicht mit — ein Kurs mit 12 Plätzen kann faktisch mehr Leute haben |
| Leader/Follower-Balance | zählt nicht mit; die Verteilung stimmt nicht |
| Geburtstage im Lehrer-Bereich (PROJ-49) | erscheint nicht |

In der Testdatenbank: 8 aktive Flatrate-Abos, davon **keines** mit einem Kurs
verknüpft.

## User Stories

- Als **Kunde mit Flatrate** möchte ich mich mit einem Klick für einen weiteren
  Kurs eintragen, ohne ein zweites Abo abzuschließen, damit ich nicht doppelt
  zahle und nicht jedes Mal dasselbe Formular ausfülle.
- Als **Kunde mit Flatrate** möchte ich mich aus einem Kurs wieder abmelden,
  ohne meine Flatrate anzutasten, damit ich meinen Plan ändern kann, ohne
  anzurufen.
- Als **Kunde mit Flatrate** möchte ich sehen, in welchen Kursen ich
  eingeschrieben bin, damit ich weiß, was für mich reserviert ist.
- Als **Lehrer** möchte ich Flatrate-Kunden in meiner Anwesenheitsliste sehen,
  damit ich sie nicht in jeder Stunde von Hand nachtragen muss.
- Als **Betreiber** möchte ich die Kursliste eines Flatrate-Kunden ändern
  können, damit ich Anrufe direkt erledige statt den Kunden anzuleiten.
- Als **Betreiber** möchte ich, dass Flatrate-Kunden gegen die Kursgrenze
  zählen, damit ein Kurs nicht stiller überfüllt ist, als der Bildschirm sagt.

## Out of Scope

- **Wechsel von Einzelkurs-Abo auf Flatrate** („Upgrade") — eigener Vorgang mit
  Preis- und Stichtagsfragen. Heute wie bisher: kündigen und neu buchen.
- **Obergrenze für die Anzahl Kurse** — bewusst keine (siehe Decision Log).
- **Eigene Preisstufen je Kursanzahl** (z. B. „bis 3 Kurse günstiger") — die
  Flatrate bleibt ein Preis für alles.
- **Rückwirkende Korrektur bereits doppelt abgebuchter Kunden** — falls in der
  Produktion doppelte Flatrate-Abos existieren, werden sie vom Betreiber
  einzeln über PROJ-46 (Storno/Gutschrift) bereinigt, nicht automatisch.
- **Anwesenheitspflicht oder Verfall bei Nichterscheinen** — wer einen Platz
  belegt und nicht kommt, fällt in der Anwesenheitsliste auf; automatisch
  passiert nichts.
- **Probestunden und Drop-ins** — bleiben unverändert, sie haben mit dem Abo
  nichts zu tun.

## Acceptance Criteria

**Kunde: Kurs hinzufügen**

- [ ] Angenommen ein Kunde hat eine aktive Flatrate, wenn er im Kurskatalog oder
      im Stundenplan einen Kurs öffnet, in dem er noch nicht ist, dann heißt die
      Aktion „Zu meiner Flatrate hinzufügen" statt „Jetzt buchen"
- [ ] Angenommen ein Kunde hat eine aktive Flatrate und der Kurs fragt weder
      Tanzrolle noch Vorkenntnisse ab, wenn er „Zu meiner Flatrate hinzufügen"
      wählt, dann ist er sofort im Kurs — ohne Dialog, ohne Bestätigung durch
      den Betreiber
- [ ] Angenommen der Kurs fragt die Tanzrolle ab, wenn der Kunde ihn hinzufügt,
      dann wird nur die Tanzrolle abgefragt — kein Startdatum, keine erneute
      AGB-Zustimmung
- [ ] Angenommen der Kurs hat einen Vorkenntnisse-Hinweis, wenn der Kunde ihn
      hinzufügt, dann muss er den Hinweis bestätigen wie bei einer regulären
      Buchung
- [ ] Angenommen ein Kunde hat eine aktive Flatrate, wenn er einen Kurs
      hinzufügt, dann entsteht **kein** neues Abo und **keine** zusätzliche
      Abbuchung
- [ ] Angenommen ein Kunde ist bereits in einem Kurs, wenn er dessen Seite
      öffnet, dann wird ihm das angezeigt und keine Aktion zum Hinzufügen
      angeboten

**Kunde: Kurs entfernen**

- [ ] Angenommen ein Flatrate-Kunde ist in einem Kurs eingeschrieben, wenn er
      ihn unter „Mein Profil" entfernt, dann ist er sofort nicht mehr im Kurs
      und seine Flatrate läuft unverändert weiter
- [ ] Angenommen ein Kurs war voll und jemand steht auf der Warteliste, wenn ein
      Flatrate-Kunde sich aus diesem Kurs abmeldet, dann rückt die Warteliste nach
- [ ] Angenommen ein Flatrate-Kunde entfernt seinen letzten Kurs, wenn er danach
      „Mein Profil" öffnet, dann sieht er einen Hinweis, dass seine Flatrate
      läuft, er aber in keinem Kurs eingeschrieben ist — mit Verweis auf den
      Kurskatalog

**Grenzen und Sperren**

- [ ] Angenommen ein Kurs ist voll, wenn ein Flatrate-Kunde ihn hinzufügen will,
      dann wird er abgewiesen mit dem Hinweis, dass der Kurs voll ist, und
      bekommt die Warteliste angeboten
- [ ] Angenommen ein Kurs achtet auf das Leader/Follower-Verhältnis, wenn ein
      Flatrate-Kunde in der überzähligen Rolle hinzufügen will, dann wird er mit
      derselben Begründung abgewiesen wie bei einer regulären Buchung
- [ ] Angenommen Flatrate-Kunden sind in einem Kurs eingeschrieben, wenn die
      Kursgrenze geprüft wird, dann zählen sie mit
- [ ] Angenommen ein Kunde hat **keine** aktive Flatrate, wenn er einen Kurs
      öffnet, dann sieht er den bisherigen Buchungsdialog unverändert

**Abo-Status wirkt auf die Kurse**

- [ ] Angenommen ein Flatrate-Kunde ist in drei Kursen, wenn seine Flatrate
      pausiert oder gekündigt wird, dann ist er in keinem dieser Kurse mehr
      eingeschrieben und die Plätze werden frei
- [ ] Angenommen die Flatrate eines Kunden wurde pausiert, wenn er sie
      reaktiviert, dann werden ihm seine vorherigen Kurse als Vorschlag
      angezeigt und er trägt sich mit je einem Klick wieder ein
- [ ] Angenommen ein Kurs eines pausierten Kunden ist inzwischen voll, wenn er
      ihn wieder hinzufügen will, dann wird er wie jeder andere abgewiesen und
      bekommt die Warteliste angeboten

**Lehrer und Kursbetrieb**

- [ ] Angenommen ein Flatrate-Kunde ist in einem Kurs eingeschrieben, wenn der
      Lehrer die Anwesenheitsliste öffnet, dann steht der Kunde darin, ohne dass
      jemand ihn von Hand hinzufügt
- [ ] Angenommen ein Flatrate-Kunde hat eine Tanzrolle für diesen Kurs
      angegeben, wenn der Lehrer die Anwesenheitsliste öffnet, dann steht sie
      dabei wie bei einem kursgebundenen Abo

**Warteliste**

- [ ] Angenommen ein Flatrate-Kunde steht auf der Warteliste und ein Platz wird
      frei, wenn die Nachrückung läuft, dann wird der Kurs direkt zu seiner
      Flatrate hinzugefügt und er erhält die Nachrück-Benachrichtigung
- [ ] Angenommen ein Flatrate-Kunde rückt nach, wenn der Vorgang abgeschlossen
      ist, dann entsteht **keine** offene Anfrage beim Betreiber und **kein**
      zweites Abo

**Betreiber**

- [ ] Angenommen der Betreiber öffnet einen Kunden mit Flatrate unter
      `/admin/kunden`, wenn er dessen Abo ansieht, dann sieht er die Liste der
      belegten Kurse
- [ ] Angenommen der Betreiber sieht die Kursliste eines Flatrate-Kunden, wenn
      er einen Kurs hinzufügt oder entfernt, dann wirkt das sofort — mit
      denselben Sperren wie beim Kunden, aber überschreibbar bei voller Kursgrenze
- [ ] Angenommen der Betreiber bestätigt eine **neue** Flatrate-Anfrage, wenn
      der Vorgang abgeschlossen ist, dann ist der angefragte Kurs die erste
      Position der Kursliste dieses Abos

**Bestandsdaten**

- [ ] Angenommen ein Kunde hatte vor der Umstellung eine Flatrate mit einer
      bestätigten Kursbuchung, wenn die Umstellung eingespielt ist, dann ist
      dieser Kurs seiner Kursliste zugeordnet
- [ ] Angenommen ein Kunde hatte eine Flatrate ohne verknüpfte Buchung, wenn die
      Umstellung eingespielt ist, dann ist seine Kursliste leer und er kann sich
      selbst eintragen

## Edge Cases

- **Zwei Kunden greifen nach dem letzten Platz** — die Kursgrenze wird beim
  Hinzufügen unter derselben Sperre geprüft wie bei einer regulären Buchung
  (Zeilensperre auf dem Kurs). Der Zweite bekommt „Kurs ist voll", nicht einen
  Platz, den es nicht gibt.
- **Kunde fügt hinzu, während der Betreiber gleichzeitig seine Flatrate
  kündigt** — die Kündigung gewinnt: Ohne aktives Abo entsteht keine
  Kurszuordnung. Der Kunde bekommt eine verständliche Meldung statt eines
  stillen Fehlschlags.
- **Kunde ist in einem Kurs und bucht ihn zusätzlich als Drop-in** — bleibt
  erlaubt und unverändert; ein Drop-in ist eine Einzelstunde und hat mit der
  Kurszugehörigkeit nichts zu tun.
- **Kunde mit Flatrate steht noch auf einer Warteliste, die er über eine
  Einzelkurs-Anfrage betreten hat** — beim Nachrücken gilt sein *heutiger*
  Zustand: Er hat eine Flatrate, also wird der Kurs zugeordnet statt eine
  Anfrage erzeugt.
- **Betreiber löscht einen Kurs, in dem Flatrate-Kunden sind** — die
  Zuordnungen verschwinden mit dem Kurs; die Flatrate bleibt unberührt.
- **Kunde hat zwei aktive Flatrate-Abos aus der Zeit vor der Umstellung** — die
  Umstellung ordnet die Kurse dem *ältesten* aktiven Abo zu. Das doppelte Abo
  bleibt bestehen und muss vom Betreiber bereinigt werden; die Spec repariert
  keine Abrechnung rückwirkend. **In der Produktion betrifft das zwei Kunden**
  (Stand 2026-09-10, beides Testnutzer) — sie werden vor der Umstellung von Hand
  bereinigt, damit die Migration nicht auf einem doppelten Abo aufsetzt.
- **Kurs ohne hinterlegten Wochentermin** — kann hinzugefügt werden; er taucht
  dann nur nicht im Stundenplan auf. Kein Sonderfall.
- **Kunde entfernt einen Kurs mitten in der Stunde** — bereits erfasste
  Anwesenheit bleibt erhalten. Was war, war.

## Technical Requirements

- Die Kursgrenze und die Rollenbalance müssen Flatrate-Kunden **überall**
  mitzählen: beim Buchen, beim Wartelisten-Beitritt, beim Nachrücken und in der
  Anzeige der freien Plätze.
- Hinzufügen und Entfernen laufen unter derselben Nebenläufigkeitssperre wie
  eine reguläre Buchung — sonst entsteht genau die Überbuchung, die diese Spec
  beseitigen soll.
- Ein Kunde darf nur seine eigene Kursliste ändern; die Prüfung gehört in die
  Datenbank, nicht nur in die Oberfläche.
- Die Umstellung der Bestandsdaten läuft einmalig und muss wiederholbar sein,
  ohne Zuordnungen zu verdoppeln.

## Open Questions

- [ ] Wie viele Flatrate-Abos in der **Produktion** lassen sich aus bestätigten
      Buchungen ableiten? Der Betreiber prüft das vor der Umstellung mit der
      Abfrage aus dem Interview; davon hängt ab, wie viel Handarbeit bleibt.
- [x] Gibt es in der Produktion bereits Kunden mit **zwei** aktiven
      Flatrate-Abos? → **Ja, zwei Kunden** (Testnutzer der App), Stand
      2026-09-10. Beide müssen vor der Umstellung bereinigt werden: Die
      Migration ordnet die Kurse dem ältesten aktiven Abo zu, das überzählige
      bliebe sonst bestehen und würde weiter eingezogen. Ob bereits eingezogen
      wurde, entscheidet über den Weg — noch nicht eingezogen: Abo kündigen
      genügt; bereits eingezogen: Storno und Gutschrift über PROJ-46.

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|---|---|---|
| Ein Klick, sofort im Kurs — keine Bestätigung durch den Betreiber | Die Geldfrage ist mit der Flatrate bereits entschieden. Es gibt nichts mehr zu entscheiden, nur noch zu bestätigen — genau die Arbeit, die die App abnehmen soll. Die automatischen Sperren (Kursgrenze, Rollenbalance, Vorkenntnisse) greifen weiterhin | 2026-09-10 |
| Abmelden ebenfalls sofort und selbst | Es ändert nichts am Geld, es gibt keine Frist zu wahren. Wer nicht mehr kommt, blockiert sonst einen Platz. Und wer mit einem Klick hineinkommt, erwartet mit einem Klick wieder hinaus | 2026-09-10 |
| Tanzrolle und Vorkenntnisse werden weiterhin abgefragt | Beide gehören zum **Kurs**, nicht zur Person: Jemand kann in Salsa Leader und in Bachata Follower sein, und der Vorkenntnisse-Hinweis ist der Grund, warum niemand versehentlich im falschen Level landet | 2026-09-10 |
| Startdatum und AGB-Zustimmung entfallen | Bei laufender Flatrate gibt es keinen Abrechnungsgrund für ein späteres Startdatum — es gilt der nächste Termin. Und es entsteht kein neuer Vertrag, nur ein Kurs mehr im bestehenden | 2026-09-10 |
| Pause und Kündigung entfernen alle Kurse | Genau das passiert heute schon bei kursgebundenen Abos: Anwesenheitsliste und Kursgrenze zählen nur aktive Abos. Kehrseite bewusst in Kauf genommen — nach der Pause kann der Kurs voll sein; die alten Kurse stehen als Vorschlag bereit | 2026-09-10 |
| Keine Obergrenze für die Anzahl Kurse | Die Flatrate heißt „alle Kurse". Die Kursgrenze pro Kurs bremst bereits — wer sich für acht Kurse einträgt, nimmt niemandem etwas weg, solange überall Platz ist. Wer wirklich blockiert, fällt in der Anwesenheitsliste auf | 2026-09-10 |
| Bestandskunden werden automatisch aus ihren bestätigten Buchungen abgeleitet | Niemand muss etwas tun, und die Lehrer sehen die Leute sofort in der Anwesenheitsliste. Wo nichts verknüpft ist, bleibt die Liste leer und der Kunde trägt sich selbst ein | 2026-09-10 |
| Hinzufügen dort, wo heute gebucht wird — Entfernen im Profil | Der Kunde sucht Kurse, wo Kurse stehen, nicht in seiner Abo-Verwaltung. Die Übersicht seiner Kurse gehört dagegen zu seinem Abo | 2026-09-10 |
| Die Admin-Ansicht gehört in dieselbe Spec | Der Betreiber bekommt die Anrufe. Ohne sie bliebe ihm nur, den Kunden anzuleiten. Bewusste Abweichung von der Regel „Kunden- und Adminfunktionen trennen": Es ist derselbe Vorgang, nur mit anderer Schaltfläche | 2026-09-10 |
| Der Betreiber darf die Kursgrenze überschreiben, der Kunde nicht | Ein Kurs ist manchmal für einen Menschen voll und für einen anderen nicht. Diese Entscheidung gehört dem Betreiber — dem Kunden aber gerade nicht, sonst ist die Grenze keine | 2026-09-10 |
| Nachrücken trägt direkt ein, statt eine Anfrage zu erzeugen | Konsequent zur Entscheidung oben. Die offene Anfrage ist genau der Weg, auf dem heute das zweite Abo entsteht | 2026-09-10 |
| Rückwirkende Abrechnungskorrektur bleibt draußen | Doppelt abgebuchte Kunden sind Einzelfälle mit Rechnungsbezug; die gehören über Storno und Gutschrift (PROJ-46) bereinigt, nicht über eine Migration | 2026-09-10 |

### Technical Decisions

_Wird von `/architecture` ergänzt._
