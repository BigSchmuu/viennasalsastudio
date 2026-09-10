# PROJ-50: Flatrate für mehrere Kurse

## Status: Deployed
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
| Kursausfall-Benachrichtigung (PROJ-38) | wird **nicht benachrichtigt** — er steht vor verschlossener Tür |
| Selbst-Check-in (PROJ-25) | darf sich nicht selbst eintragen |
| Freie Plätze im Katalog (`get_course_occupancy`) | der Kurs wirkt leerer, als er ist |

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
| Ein Kurs zur Flatrate braucht **kein** SEPA-Mandat | Aufgekommen beim Testlauf: Die Regel „ohne Mandat keine Anmeldung" schützt davor, eine Zahlungspflicht ohne Zahlungsweg einzugehen. Beim Hinzufügen entsteht keine neue Pflicht — die besteht bereits. Ein aktives Abo ohne Mandat ist ein Problem des Abos, nicht des Kurses, und die App meldet es dem Betreiber bereits unter /admin/kunden | 2026-09-10 |
| Ein Flatrate-Kunde kann keinen Gutschein mehr einlösen | Folge, keine Absicht: Er sieht den Buchungsdialog nicht mehr, also auch kein Codefeld. Richtig so — ein Gutschein vergünstigt ein **neues** Abo, und genau das entsteht hier nicht mehr | 2026-09-10 |
| Rückwirkende Abrechnungskorrektur bleibt draußen | Doppelt abgebuchte Kunden sind Einzelfälle mit Rechnungsbezug; die gehören über Storno und Gutschrift (PROJ-46) bereinigt, nicht über eine Migration | 2026-09-10 |

### Technical Decisions

| Decision | Rationale | Date |
|---|---|---|
| Eine gemeinsame Definition von „ist im Kurs", die alle Lesestellen benutzen | Heute beantworten **zehn** Stellen dieselbe Frage, jede für sich. Genau daran ist die Flatrate gescheitert, und genau so entstehen die stillen Fehler, die dieses Projekt schon dreimal getroffen haben. Eine Definition kann falsch sein — zehn können auseinanderlaufen | 2026-09-10 |
| Kursplätze als eigene Datensätze, `subscriptions.course_id` bleibt vorerst | Alles auf einmal umzustellen hieße, auch Abrechnung, Umbuchung und Fälligkeiten anzufassen — Tage vor der Inbetriebnahme. Weil niemand mehr direkt liest, ist die Doppelung hinter der gemeinsamen Definition verborgen und später ohne Änderung an den Lesestellen auflösbar | 2026-09-10 |
| Kursplätze werden beendet, nicht gelöscht | Ein beendeter Platz ist die Erinnerung, die der Vorschlag nach der Pause braucht. Und er erklärt später, warum jemand im Mai in einer Anwesenheitsliste stand | 2026-09-10 |
| Die Tanzrolle steht am Kursplatz, nicht am Abo | Sie gehört zum Kurs: Jemand kann in Salsa Leader und in Bachata Follower sein. Am Abo ließe sich das nicht abbilden | 2026-09-10 |
| Hinzufügen und Entfernen laufen in der Datenbank, nicht im Anwendungscode | Die Kursgrenze verlangt dieselbe Zeilensperre wie eine reguläre Buchung. Im Anwendungscode geprüft, greifen zwei gleichzeitige Klicks am letzten Platz vorbei | 2026-09-10 |
| Keine neuen Pakete | Es entsteht keine neue Art von Oberfläche — bestehende Bausteine reichen | 2026-09-10 |

---

## Tech Design (Solution Architect)

### Die Kernfrage: eine Tür statt zehn

Der Fehler in der Flatrate ist nicht, dass eine Stelle etwas falsch macht. Er
ist, dass **zehn Stellen dieselbe Frage getrennt beantworten** — „wer ist in
diesem Kurs?" — und alle zehn dieselbe Spalte lesen, die bei einer Flatrate leer
ist. Nachgezählt am 2026-09-10:

| Stelle | Was sie heute entscheidet | Folge für den Flatrate-Kunden |
|---|---|---|
| Kursbuchung | „bereits angemeldet", Kursgrenze, Rollenbalance | **erzeugt das zweite Abo** |
| Wartelisten-Beitritt | dieselben drei Prüfungen | tritt einer Liste bei, auf der er nicht sein müsste |
| Nachrückung | Kursgrenze, Rollenbalance | erzeugt eine offene Anfrage statt eines Platzes |
| Anwesenheitsliste | wer steht in der Matrix | fehlt; der Lehrer trägt ihn jede Stunde nach |
| Freie Plätze im Katalog | die angezeigte Belegung | der Kurs wirkt leerer, als er ist |
| Selbst-Check-in | „darf ich mich eintragen?" | wird abgewiesen |
| Teilnehmernamen (PROJ-49) | Namen für Lehrer | fehlt |
| Aktive Kursteilnehmer (PROJ-49) | Geburtstage | fehlt |
| Kursausfall (PROJ-38) | wer wird benachrichtigt | **erfährt nichts und steht vor der Tür** |
| Umbuchung eines Einzelkurs-Abos | Kurswechsel | nicht betroffen, bleibt unberührt |

Jede Stelle einzeln zu reparieren hieße, neun neue Gelegenheiten zu schaffen,
eine zu vergessen. Deshalb bekommt die Frage **eine einzige Antwort**, die alle
benutzen: eine benannte Sicht „Kursmitgliedschaften", die sagt, wer gerade in
welchem Kurs ist — egal ob über ein kursgebundenes Abo oder über eine Flatrate.
Danach liest keine Stelle mehr selbst nach.

Das ist zugleich die Antwort auf eine Sorge aus PROJ-49: Solange zwei Wahrheiten
nebeneinander stehen, laufen sie auseinander. Hier gibt es künftig eine.

### Datenmodell

**Neu — der Kursplatz.** Ein Datensatz, der festhält:

- welcher Kunde
- in welchem Kurs
- über welches Abo er dort ist
- mit welcher Tanzrolle (falls der Kurs danach fragt)
- seit wann — und, sobald er endet, bis wann

Ein kursgebundenes Abo hat genau einen solchen Platz, eine Flatrate beliebig
viele. **Kein Preis am Kursplatz**: Was jemand zahlt, steht weiterhin
ausschließlich am Abo. Das ist die Trennung, die heute fehlt — „was kostet es"
und „wo bin ich drin" sind zwei Fragen, nicht eine.

**Beendet statt gelöscht.** Wird eine Flatrate pausiert oder gekündigt, bekommen
ihre Kursplätze ein Enddatum. Sie zählen ab sofort nirgends mehr mit — der Platz
ist frei, die Warteliste rückt nach. Aber die Erinnerung bleibt, und daraus
entsteht nach der Pause der Vorschlag „das waren deine Kurse". Nebenbei erklärt
ein beendeter Platz später, warum jemand im Mai in einer Anwesenheitsliste
stand.

**Was unverändert bleibt:** Abos, Preise, Lastschriften, Rechnungen. Diese Spec
fasst keine Abrechnung an.

### Was sich in der Bedienung ändert

```
Kurskatalog / Kursdetail / Stundenplan
+-- Kurskarte
    +-- [Kunde ohne Flatrate]  → „Jetzt buchen" (unverändert, voller Dialog)
    +-- [Flatrate, nicht im Kurs]
    |   +-- „Zu meiner Flatrate hinzufügen"
    |       +-- Kurs fragt nichts ab      → sofort drin, kurze Rückmeldung
    |       +-- Kurs fragt Rolle ab       → kleiner Dialog: nur Leader/Follower/Beide
    |       +-- Kurs hat Vorkenntnisse    → zusätzlich das Häkchen aus PROJ-27
    |       +-- Kurs ist voll             → Hinweis + Angebot Warteliste
    +-- [Flatrate, bereits im Kurs] → Hinweis „Du bist in diesem Kurs", keine Aktion

Mein Profil → Abo-Bereich
+-- Flatrate-Abo
    +-- Liste „Meine Kurse"
    |   +-- je Kurs: Name, Termin, Tanzrolle, „Entfernen"
    +-- [keine Kurse] → Hinweis + Verweis auf den Kurskatalog
    +-- [nach einer Pause] → „Deine früheren Kurse" mit je einem Knopf

Admin → Kunden → Kundendetail
+-- Abo-Verwaltung (bestehend)
    +-- [bei Flatrate] Kursliste
        +-- je Kurs: Name, „Entfernen"
        +-- „Kurs hinzufügen" (Auswahl)
            +-- bei vollem Kurs: Warnung, aber überschreibbar
```

Für Kunden **ohne** Flatrate ändert sich an keiner Stelle etwas.

### Wo die Arbeit wirklich liegt

Nicht in der Oberfläche — die ist überschaubar. Sondern darin, die zehn
Lesestellen auf die gemeinsame Definition umzustellen, ohne dabei eine zu
übersehen oder eine bestehende Funktion zu verändern. Vier davon sind
Prüfungen, an denen Geld oder Plätze hängen (Buchung, Warteliste, Nachrückung,
Selbst-Check-in); drei versorgen den Lehrer; zwei die Anzeige.

Die Absicherung dagegen ist ein Test je Lesestelle, der mit einem
**Flatrate-Kunden** arbeitet — nicht mit einem kursgebundenen. Ohne das bleibt
jeder dieser Tests grün, egal was passiert: Genau dieselbe Falle wie bei den
Lehrer-Tests, die sich als Admin angemeldet hatten.

### Umstellung der Bestandsdaten

Jede bestätigte Flatrate-Buchung ist bereits mit ihrem Abo verknüpft. Daraus
entsteht beim Einspielen einmalig je ein Kursplatz — samt der damals gewählten
Tanzrolle. Wo keine Verknüpfung existiert, bleibt die Liste leer und der Kunde
trägt sich selbst ein.

Die Umstellung muss wiederholbar sein, ohne Plätze zu verdoppeln: Ein zweiter
Lauf darf nichts anrichten. Das ist kein Luxus — eine Migration wird öfter
angefasst, als man plant.

**Vorher zu erledigen (Betreiber):** Die zwei Kunden mit doppelter Flatrate
bereinigen. Die Umstellung ordnet die Kurse dem ältesten aktiven Abo zu; das
überzählige bliebe sonst bestehen und würde weiter eingezogen.

### Gleichzeitigkeit

Hinzufügen und Entfernen laufen vollständig in der Datenbank, unter derselben
Sperre auf den Kurs, die eine reguläre Buchung heute schon nimmt. Zwei Kunden,
die im selben Moment nach dem letzten Platz greifen, bekommen dadurch die
richtige Antwort: einer den Platz, einer den Hinweis. Im Anwendungscode geprüft,
kämen beide durch.

Dasselbe gilt für den Fall „Kunde tritt ein, während der Betreiber kündigt": Ohne
aktives Abo entsteht kein Kursplatz, und der Kunde bekommt einen verständlichen
Satz statt eines stillen Fehlschlags.

### Neue Pakete

Keine. Es entsteht keine neue Art von Oberfläche — Karten, Dialoge, Listen und
Auswahlfelder sind vorhanden.

---

## Umsetzungsnotizen — Fundament und Oberfläche (2026-09-10)

### Was gebaut wurde

| Baustein | Aufgabe |
|---|---|
| `course_memberships` (Tabelle) | Der Kursplatz: Kunde, Kurs, Abo, Tanzrolle, seit wann, bis wann |
| `course_members` (Sicht) | Die eine Antwort auf „wer ist in diesem Kurs?" |
| `beende_kursplaetze_bei_abo_ende` (Trigger) | Ein Abo, das nicht mehr aktiv ist, hat keine Kursplätze |
| `add_course_to_flatrate` / `remove_course_from_flatrate` | Der Kundenweg, mit allen Sperren unter Zeilensperre |
| `admin_add_course_membership` / `admin_remove_course_membership` | Derselbe Vorgang für den Betreiber, Kursgrenze überschreibbar |
| `kurs_belegung` / `kurs_rollenanzahl` | Belegung und Rollenzahlen an einer Stelle statt fünfmal |
| `promote_waitlist_internal` | Nachrückung ohne Rechteprüfung, damit auch ein Kunde sie auslösen kann |
| `src/lib/flatrate/kurszugehoerigkeit.ts` | Dieselbe Frage auf der Anwendungsseite, einmal beantwortet |
| `FlatrateAddButton`, `FlatrateCourses`, `FlatrateCourseManager` | Katalog/Stundenplan/Kursseite, Profil, Admin |

### Drei Entscheidungen beim Bauen

**Der Trigger statt fünf Schreibstellen.** Ein Abo wird an fünf Orten pausiert
oder gekündigt: Selbstbedienung, Admin, Stapelvorgang, fällige Änderungen aus
dem Cron, Kursausfall. Eine Regel an der Tabelle gilt für alle fünf — und für
die sechste, die es noch nicht gibt.

**Die Nachrückung wurde geteilt.** `promote_waitlist_for_course` verlangte
Admin-Rechte. Gibt ein Kunde seinen Kursplatz frei, muss aber auch nachgerückt
werden, und mit seinen Rechten scheiterte die Prüfung. Die Arbeit steht jetzt in
`promote_waitlist_internal`, das von keiner Rolle direkt aufrufbar ist; der
Admin-Zugang ist ein dünner Mantel darum.

**Das Fundament kam im Frontend-Durchgang mit.** Eine Oberfläche, die Kurse zu
einer Flatrate hinzufügt, hätte sonst auf nichts gezeigt. Die Reihenfolge des
Arbeitsablaufs passt bei diesem Feature nicht — der Kern ist die Datenbank.

### Ein Detail, das beim Bauen dazukam

`create or replace function` setzt die Rechte einer Funktion zurück, und
Supabase vergibt `EXECUTE` per Default-Privileg sofort neu an `anon`. Weil die
Nachrückung überarbeitet wurde, musste der Entzug wiederholt werden — genau der
Fall, den der QA-Befund vom Vortag beschreibt (`.claude/rules/backend.md`).

### Prüfung

20 E2E-Fälle (10 × 2 Browser) in `tests/PROJ-50-flatrate-mehrere-kurse.spec.ts`,
alle grün. Die Suite legt ihre Kurse selbst an und räumt sie weg: Ein Kursplatz
taucht in Anwesenheitsliste, Kursgrenze und Rollenbalance auf, und geteilte
Fixtures haben in diesem Projekt schon zweimal fremde Tests umgeworfen.

Der aussagekräftigste Fall zählt die Abos vor und nach dem Hinzufügen — gleich
viele. Das war der eigentliche Fehler.

### Zwei Testsuiten, die die Änderung berührt hat

Der vollständige Lauf ergab 967 bestanden und 4 Fehlschläge — zwei Fälle auf je
zwei Browsern. Beide waren aufschlussreich:

**PROJ-15** gab seinem Kunden absichtlich eine Flatrate, um „ein Abo, das vom
Gutschein disqualifiziert, ohne in diesen Kurs einzuschreiben" herzustellen.
Seit PROJ-50 erreicht dieser Kunde den Buchungsdialog nicht mehr. Der Test
benutzt jetzt ein kursgebundenes Abo für einen anderen Kurs — dieselbe Lage,
aber erreichbar.

**PROJ-8/PROJ-9** teilen sich eine Fixture: „Kunde ohne Mandat" ist zugleich
„Kunde mit mehreren Abos". Ihre drei Abos hießen „Multi Abo A/B" und „Paused
Abo", hatten aber `course_id: null` — technisch also drei Flatrates, was seit
PROJ-50 den ganzen Katalog dieses Kunden verändert. Der bequeme Weg zu einem
Abo war nie als Flatrate gemeint. Sie haben jetzt einen Kursbezug, und der steht
im `beforeAll` von PROJ-9 statt nur in den Daten — sonst wäre es wieder eine
Wahrheit, die niemand im Code findet.

Nach beiden Korrekturen: 112 Fälle über die fünf berührten Suiten, alle grün.

---

## Umsetzungsnotizen — die Lesestellen (2026-09-10)

Bis hierher gab es die gemeinsame Antwort, aber niemand las sie: Die Kursplätze
existierten und blieben unsichtbar. Dieser Durchgang dreht die Stellen um.

- [x] `get_course_attendance_roster` — der Flatrate-Kunde steht jetzt in der Liste
- [x] `create_regular_course_booking` — Kursgrenze, Rollenbalance, „bereits angemeldet"
- [x] `join_waitlist` — dieselben drei
- [x] `self_toggle_attendance` — Selbst-Check-in
- [x] `course-cancellation.ts` — über `get_course_member_ids`
- [x] `get_course_occupancy` — freie Plätze im Katalog
- [x] `get_course_participants`, `get_course_active_subscribers`, `get_course_dance_roles`

### Drei Dinge, die dabei dazukamen

**Ein Riegel in der Datenbank.** Wer eine aktive Flatrate hat, kann keine
reguläre Buchung mehr auslösen — genau über diesen Aufruf entstand das zweite
Abo. Die Oberfläche bietet es längst nicht mehr an; der Riegel gehört aber
dorthin, wo er nicht zu umgehen ist. Fehlermeldung: `flatrate covers this`, im
Buchungsvorgang in einen verständlichen Satz übersetzt.

**Kein Mandat für die Warteliste.** `join_waitlist` verlangte ein SEPA-Mandat.
Für einen Flatrate-Kunden entfällt das aus demselben Grund wie beim Hinzufügen:
Es entsteht keine neue Zahlungspflicht. Ohne diese Ausnahme hätte er sich
eintragen, aber nicht auf die Warteliste setzen können — inkonsequent.

**Die Rollen kommen jetzt vom Kursplatz.** `get_course_dance_roles` liefert eine
Zeile je Teilnehmer statt je Buchung; die frühere Auswertung „die jüngste
Buchung gewinnt" ist gegenstandslos. Die Kommentare an beiden Aufrufstellen
wurden mitgezogen, damit sie nicht das Gegenteil behaupten.

### Ein Fehler, den ich beim Bauen gemacht habe

`self_toggle_attendance` hatte ich zunächst aus dem Gedächtnis nachgebaut, weil
ich nur die erste Hälfte gelesen hatte. Dabei habe ich still eine Regel erfunden
(„nach Stundenende kein Check-in mehr") und die echte verloren („nach
Stundenende nicht mehr zurücknehmen"). Aufgefallen ist es nur, weil ich den
Rumpf vor dem Anwenden noch einmal abgeglichen habe. Die Funktion ist jetzt
wortgleich mit der bisherigen — bis auf die eine Zeile, um die es ging.

### Prüfung

26 E2E-Fälle (13 × 2 Browser). Neu dazu je ein Fall für die Stellen, an denen
der Flatrate-Kunde bisher unsichtbar war:

- Er steht in der Anwesenheitsliste des Lehrers.
- Er zählt gegen die Kursgrenze — ein zweiter Kunde bekommt „Kurs ist voll".
- Er kann keine reguläre Buchung mehr auslösen.

Alle drei melden sich als **Flatrate-Kunde** an, nicht als Admin. Genau diese
Verwechslung hat in PROJ-30 und PROJ-31 dafür gesorgt, dass ein Fehler
wochenlang grün war.

---

## QA Test Results

**Geprüft:** 2026-09-10
**Gegen:** lokale Testumgebung (Port 3100), beide Browser
**Prüfer:** QA (AI)

### Akzeptanzkriterien: 21 von 25 belegt, 1 fehlgeschlagen, 3 offen

| Bereich | Kriterien | Stand |
|---|---|---|
| Kurs hinzufügen | 6 | ✅ alle |
| Kurs entfernen | 3 | ✅ alle |
| Grenzen und Sperren | 4 | ✅ 3 · ⚠️ Rollenverhältnis ungetestet |
| Abo-Status wirkt | 3 | ✅ alle |
| Lehrer und Kursbetrieb | 2 | ✅ 1 · ⚠️ Tanzrolle in der Liste ungetestet |
| Warteliste | 2 | ✅ beide |
| Betreiber | 3 | ✅ 2 · ❌ **BUG-1** |
| Bestandsdaten | 2 | ⚠️ nur durch die Migration selbst belegt |

21 E2E-Fälle × 2 Browser: **40 bestanden, 2 fehlgeschlagen** (BUG-1 auf beiden).

### Gefundener Fehler

#### BUG-1: Beim Bestätigen einer neuen Flatrate-Anfrage entsteht kein Kursplatz
- **Schweregrad:** High
- **Steht in:** `src/lib/actions/admin/bookings.ts` (Stapel-Bestätigung) und
  `src/lib/actions/admin/subscriptions.ts` (Abo von Hand anlegen)
- **Tatsächlich:** Die Bestätigung legt ein Abo ohne Kursbezug an und verknüpft
  die Buchung damit — aber **keinen Kursplatz**. Der Kunde zahlt und sitzt in
  keinem Kurs: nicht in der Anwesenheitsliste, nicht in der Kursgrenze, ohne
  Ausfall-Benachrichtigung.
- **Nachgewiesen:** `tests/PROJ-50…spec.ts`, Fall „BEFUND: Bestätigt der
  Betreiber eine neue Flatrate-Anfrage, entsteht ein Kursplatz" — schlägt fehl
  mit „Received length: 0".
- **Einordnung:** Keine Regression, sondern eine **Lücke in der Behebung**. Vor
  PROJ-50 war derselbe Kunde ebenso unsichtbar — das war ja der Ausgangsfehler.
  Die Migration hat die Bestandsdaten geheilt, der Selbstbedienungsweg und die
  Nachrückung sind versorgt; der Weg über die Bestätigung nicht.
- **Warum es zählt:** Das ist der **Normalweg für jeden neuen Flatrate-Kunden**.
- **Priorität:** vor dem Deployment beheben

### Sicherheitsprüfung (Red Team)

- ✅ Ein Kunde kann über `admin_add_course_membership` keinen fremden Kursplatz
  anlegen — „not authorized".
- ✅ Ein Kunde sieht beim Lesen von `course_memberships` **nur eigene Zeilen**
  (geprüft mit angelegtem Fremdplatz, nicht bloß aus der Regel geschlossen).
- ✅ `add_course_to_flatrate` und `remove_course_from_flatrate` arbeiten
  ausschließlich auf `auth.uid()`; ein fremder Kunde ist nicht adressierbar.
- ✅ Ein Kunde **ohne** Flatrate wird von `add_course_to_flatrate` abgewiesen
  („no flatrate") — der Zaun steht in der Datenbank, nicht im Bildschirm.
- ✅ Die Sicht `course_members` ist für `public`, `anon` und `authenticated`
  gesperrt; sie ist nur aus `SECURITY DEFINER`-Funktionen erreichbar.
- ✅ Kursgrenze und Rollenbalance laufen unter Zeilensperre auf den Kurs —
  zwei gleichzeitige Klicks auf den letzten Platz greifen nicht aneinander
  vorbei.

Keine personenbezogenen Daten in Antworten, die nicht hingehören.

### Was ungeprüft blieb

Bewusst benannt statt stillschweigend übergangen:

- **Rollenverhältnis beim Hinzufügen** — dieselbe Rechnung wie bei der Buchung
  (`kurs_rollenanzahl`), dort geprüft; der Weg über die Flatrate nicht.
- **Tanzrolle in der Anwesenheitsliste** — die Verteilung im Lehrer-Bereich ist
  geprüft (PROJ-49 AC14, über Kursplatz *und* kursgebundenes Abo), die
  Markierung an der einzelnen Zeile nicht.
- **Kursgrenze überschreiben als Betreiber** — der Weg „Entfernen" ist geprüft,
  „trotzdem eintragen" nicht.
- **Ableitung der Bestandsdaten** — in der Testdatenbank gab es keine
  verknüpften Flatrate-Buchungen, die Migration hatte dort nichts zu tun. Der
  Beleg steht also aus; in der Produktion zeigt ihn die Prüfabfrage.

### Zusammenfassung

| | |
|---|---|
| Akzeptanzkriterien | 22 / 25 belegt |
| Fehler | 0 kritisch, 1 hoch — **behoben**, 0 mittel, 0 niedrig |
| Sicherheit | keine Befunde |

**Produktionsreif: JA** (nach Behebung von BUG-1). Nachlauf: 21 Fälle × 2
Browser grün, dazu PROJ-12 und PROJ-13 als Regression — zusammen 86 Fälle ohne
Fehlschlag.

**Vor dem Deployment einzuspielen:**
`20260910150000_proj50_bestaetigung_erzeugt_kursplatz.sql`. Die Produktion hat
die Lücke derzeit noch: Eine dort bestätigte Flatrate-Anfrage erzeugt keinen
Kursplatz.

---

## Deployment (2026-09-10)

Produktion: https://app.viennasalsastudio.at — Vercel-Deployment `glzsulcvd`,
Buildzeit 1 min, Commits `6ed1528` bis `75cf801`.

Sechs Migrationen hat der Betreiber eingespielt (`…100000` bis `…150000`),
die doppelten Flatrate-Abos vorher bereinigt.

**Kein neuer Volllauf vor dem Deployment:** Der ausgelieferte Code ist
byte-identisch mit dem Stand, der 998 von 998 Fällen bestanden hat — seit
`831a783` kamen nur Tests, eine Migration und Dokumentation dazu
(`git diff --stat 831a783..HEAD -- src/ messages/` ist leer).

Nach dem Deployment geprüft: öffentliche Routen 200, geschützte 307 auf
`/login`, und drei Belege, dass wirklich der neue Stand läuft — das Augen-Icon
auf `/login`, der Flatrate-Knopf im Katalog, die englische Herkunftsfrage unter
`/en/kurse`.

---

## Nachtrag: drei übersehene Lesestellen (2026-09-10, aus dem Betrieb gemeldet)

**Meldung:** Ein Flatrate-Kunde mit zwei Kursen sah unter „Mein Bereich" bei
„Dein nächster Kurs" nichts.

**Ursache:** Das Kunden-Dashboard baut seine Termine aus `subscriptions.courses`
— und die ist bei einer Flatrate leer. Es war die **achte** Lesestelle, und sie
stand nicht auf meiner Liste. Dieselbe Liste versorgt den Selbst-Check-in auf
dem Dashboard; der war damit ebenfalls tot.

Bei der Suche danach kamen zwei weitere heraus, gefunden durch eine
systematische Suche statt durch eine Stichprobe
(`grep -rn 'from("subscriptions")' src/ -A4 | grep course_id`):

| Stelle | Folge |
|---|---|
| `mein-bereich/page.tsx` | kein nächster Kurs, kein Selbst-Check-in |
| `admin/kurse/page.tsx` — Belegung | der Kurs sah leerer aus, als er ist — dort, wo über die Kursgröße entschieden wird |
| `admin/kurse/page.tsx` — Rollenverteilung | Flatrate-Kunden fehlten in Leader/Follower |
| `faellige-aenderungen.ts` | Endet eine Flatrate zum Stichtag, blieb jeder frei gewordene Platz liegen, statt an die Warteliste zu gehen |

**Was ich daraus mitnehme:** Meine ursprüngliche Liste der Lesestellen kam aus
einer Suche nach Datenbankfunktionen und einer Handvoll bekannter Dateien. Die
Anwendungsseite habe ich nur dort geprüft, wo ich sie vermutete. Die
vollständige Suche hätte alle acht auf einmal gezeigt.

Die Belegung im Admin läuft jetzt über `get_course_occupancy`, die
Rollenverteilung über `get_course_dance_roles` — beide rechnen damit dasselbe
wie alle anderen Stellen, statt eine eigene Rechnung zu führen.

Drei neue E2E-Fälle decken das ab; 43 Fälle über PROJ-50, PROJ-45, PROJ-25 und
PROJ-3 laufen grün.
