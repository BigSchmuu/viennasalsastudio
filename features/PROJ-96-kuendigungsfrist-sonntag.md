# PROJ-96: Kündigungsfrist bis Sonntag, und der Stichtag im Profil

## Status: Approved
**Created:** 2026-11-04
**Last Updated:** 2026-11-05

## Dependencies
- Requires: PROJ-9 (Abo-Selbstbedienung) — Pausieren und Kündigen im Profil, `self_schedule_subscription_change`
- Requires: PROJ-70 (Einzug nur nach Unterrichtswochen) — die ferienbewusste Rechnung, die hier zur Grundlage wird
- Requires: PROJ-80 (Kündigungsgrund) — die heutige Fassung der Kündigungsfunktion
- Requires: PROJ-51 (Kurszeitraum und Ferien) — `studio_holidays`
- Berührt: PROJ-91 (Upgrade-Differenz), PROJ-88 (Angerechnetes im Zyklus), PROJ-43 (englischer Kundenbereich), AGB (`terms-de.tsx`, `terms-en.tsx`)

## Anlass

Heute kann ein Kunde sein Abo bis zum letzten Tag des Zyklus kündigen, und die Kündigung
wirkt zum Ende genau dieses Zyklus. Für das Studio heißt das: Es erfährt am Tag des
Zyklusendes, dass ein Platz frei wird — zu spät, um ihn neu zu vergeben, und zu spät für
den Einzug, der um dieses Datum herum vorbereitet wird.

Der Betreiber will deshalb eine Frist: **gekündigt werden muss bis zum Sonntag der letzten
Kurswoche.** Und weil eine Frist nur wirkt, wenn man sie kennt, soll im Profil stehen, bis
wann sie läuft.

### Befunde aus dem Code, die den Umfang bestimmen

**1. Es gibt heute keine Frist.** `self_schedule_subscription_change`
([20261007170000](../supabase/migrations/20261007170000_proj80_kuendigungsgrund.sql)) nimmt
jede Kündigung an und setzt `pending_effective_date = next_cycle_end(cycle_anchor_date)`.
Der Anker ist der Tag des Abschlusses; Zyklusenden fallen auf jeden Wochentag.

**2. Zwei Zyklusrechnungen laufen schon heute auseinander.** Die Kündigung rechnet stur
`Anker + 28 · k`. Der Einzug rechnet nach PROJ-70 `letzter Einzug + 28 Tage + Ferientage`
(`naechsteFaelligkeit`, [faelligkeit.ts:60](../src/lib/sepa/faelligkeit.ts#L60)) — und er
hängt am **letzten Einzug**, nicht am Anker. Mit jeder Schließung driften beide weiter
auseinander: Das Profil nennt ein Zyklusende, an dem gar nicht abgebucht wird.

**3. Die Ferienlogik gibt es nur in TypeScript.** Jede SQL-Funktion rechnet mit 28 Tagen,
auch `flatrate_upgrade_zyklus_wird_abgebucht` (PROJ-91). Die Tabelle `studio_holidays`
(`starts_on`, `ends_on`) ist da, aber keine Datenbankfunktion liest sie. Eine
ferienbewusste Kündigung braucht diese Rechnung in der Datenbank — das ist der eigentliche
Umbau, nicht die Anzeige im Profil.

**4. Die AGB versprechen das Gegenteil.** [terms-de.tsx:28](../src/components/legal/terms-de.tsx#L28):
„Eine Pausierung oder Kündigung kann **jederzeit** selbständig im Kundenprofil vorgenommen
werden und wird zum Ende des jeweils laufenden 4-Wochen-Zyklus wirksam." Mit einer Frist
stimmt dieser Satz nicht mehr, in beiden Sprachfassungen.

**5. Pausieren läuft durch dieselbe Funktion.** Dasselbe RPC, derselbe
`pending_effective_date`, nur ein anderer `pending_status`. Eine Frist, die nur für das
Kündigen gilt, wäre ein Schlupfloch: erst pausieren, dann aus der Pause heraus kündigen.

## Die Regel in einem Absatz

Der Zyklusschluss **Z** eines Abos wird künftig wie der Einzug gerechnet: vier
Unterrichtswochen, Ferientage zählen nicht mit. Die Frist **F** ist der letzte Sonntag, der
auf oder vor Z liegt. Eine Kündigung oder Pause, die bis einschließlich F eingeht, wirkt zum
Z. Danach wirkt sie zum **nächsten** Zyklusschluss Z₂. Sonntage und Tage sind Wiener
Kalendertage.

```
Zyklusschluss Z   Di 11.11.        So 09.11.        Mo 10.11.
Frist F           So 09.11.        So 09.11.        So 09.11.
Vorlauf           2 Tage           0 Tage           1 Tag

Kündigung am      wirkt zum
  bis 09.11.      11.11.  (Z)
  ab 10.11.       09.12.  (Z₂)
```

## User Stories

1. **Als Kunde** will ich im Profil sehen, bis wann ich kündigen muss, damit ich die Frist
   nicht aus Unwissenheit verpasse.
2. **Als Kunde** will ich, wenn ich zu spät komme, **vor** dem Bestätigen erfahren, zu
   welchem Datum meine Kündigung dann wirkt — und nicht hinterher.
3. **Als Kunde** will ich mich auf das genannte Datum verlassen können, auch wenn das Studio
   zwischendurch Ferien hat.
4. **Als Betreiber** will ich spätestens am Sonntag der letzten Kurswoche wissen, wer geht,
   damit ich den Platz noch vergeben und den Einzug nicht zurückdrehen muss.
5. **Als Betreiber** will ich trotzdem kulant sein können: In der Verwaltung soll ich ein
   Abo ohne Frist beenden können, wenn jemand anruft und einen guten Grund hat.
6. **Als Betreiber** will ich, dass dieselbe Frist für das Pausieren gilt, damit sie nicht
   durch eine Pause umgangen wird.

## Out of Scope

- **Keine Erinnerungsnachricht** vor Ablauf der Frist. Wäre eine eigene Benachrichtigungsart
  samt Migration (`notification_queue.event_type` hat eine CHECK-Liste) und eine eigene
  Entscheidung darüber, wie oft das Studio Kunden an ihre Kündigungsmöglichkeit erinnert.
  Siehe Open Questions.
- **Keine Neuberechnung geplanter Änderungen.** Was heute mit einem Datum geplant ist,
  behält es.
- **Keine Änderung am SEPA-Lauf selbst.** Der Einzug rechnet schon ferienbewusst; hier zieht
  die Kündigung nach, nicht umgekehrt.
- **Kein Teilbetrag, keine Erstattung** für einen Zyklus, der nach der Frist noch abgebucht
  wird. Der Zyklus ist bezahlt und wird getanzt.
- **Pausierte Abos selbst kündigen** bleibt unmöglich (`status = 'active'` in der Funktion).
  Vorbestand, nicht Teil dieser Änderung.
- **Keine Frist für Probestunden, Drop-ins und Event-Tickets.** Die haben ihre eigenen
  Stornoregeln (AGB Punkt 3).
- **Kein Stichtag in der Verwaltung als Sperre.** Dort wird das Wirksamkeitsdatum angezeigt,
  aber nichts verhindert.
- **Keine zweite Frist für den Wechsel** auf Flatrate oder Pass (Upgrade). Ein Upgrade nimmt
  Geld ein und soll nicht an einer Frist scheitern.

## Acceptance Criteria

### Die Frist beim Kündigen

- [x] Angenommen der Zyklusschluss eines aktiven Abos ist Dienstag der 11.11. und heute ist
      Sonntag der 09.11., wenn der Kunde kündigt, dann wird die Kündigung zum 11.11. wirksam.
- [x] Angenommen derselbe Fall, aber heute ist Montag der 10.11., wenn der Kunde kündigt,
      dann wird die Kündigung erst zum nächsten Zyklusschluss wirksam, nicht zum 11.11.
- [x] Angenommen der Zyklusschluss fällt selbst auf einen Sonntag, wenn der Kunde an diesem
      Sonntag kündigt, dann wird die Kündigung noch zu diesem Zyklusschluss wirksam.
- [x] Angenommen im laufenden Zyklus liegt eine Ferienwoche, wenn der Zyklusschluss
      berechnet wird, dann liegt er um die Ferientage später — dasselbe Datum, das auch der
      Einzug errechnet.
- [x] Angenommen ein Abo wurde noch nie eingezogen, wenn der Zyklusschluss berechnet wird,
      dann wird vom `cycle_anchor_date` gerechnet und nicht von einem fehlenden Einzug.

### Dieselbe Frist beim Pausieren

- [x] Angenommen die Frist ist abgelaufen, wenn der Kunde stattdessen pausiert, dann wirkt
      auch die Pause erst zum nächsten Zyklusschluss.

### Die Anzeige im Profil

- [x] Angenommen ein Abo ist aktiv und die Frist läuft noch, wenn der Kunde das Profil
      öffnet, dann steht an diesem Abo der Stichtag und das Datum, zu dem eine Kündigung
      wirkt.
- [x] Angenommen die Frist für diesen Zyklus ist abgelaufen, wenn der Kunde das Profil
      öffnet, dann sagt die Zeile, dass die Frist abgelaufen ist, und nennt das Datum, zu dem
      eine Kündigung jetzt wirkt.
- [x] Angenommen für ein Abo ist schon eine Kündigung oder Pause geplant, wenn der Kunde das
      Profil öffnet, dann steht dort weiterhin das geplante Datum und kein Stichtag.
- [x] Angenommen der Kunde hat mehrere Abos mit verschiedenen Zyklen, wenn er das Profil
      öffnet, dann hat jedes Abo seinen eigenen Stichtag.
- [x] Angenommen der Kunde nutzt die englische Fassung, wenn er das Profil öffnet, dann sind
      Stichtag und Hinweis auf Englisch, mit Datum im englischen Format.

### Verwaltung und Bestand

- [x] Angenommen die Frist ist abgelaufen, wenn der Betreiber in der Verwaltung dasselbe Abo
      kündigt, dann kann er das Wirksamkeitsdatum setzen, ohne von der Frist gehindert zu
      werden.
- [x] Angenommen eine Kündigung war vor dem Ausliefern dieser Änderung geplant, wenn die
      Änderung ausgeliefert ist, dann steht im Profil unverändert das alte Datum.

### AGB

- [x] Angenommen ein Besucher liest die AGB, wenn er Punkt 2 aufschlägt, dann beschreibt der
      Text die Frist und die Rechnung nach Unterrichtswochen — in der deutschen und der
      englischen Fassung gleichlautend.

## Edge Cases

1. **Zyklusschluss an einem Sonntag → null Tage Vorlauf.** Die Frist ist dann der
   Zyklusschlusstag selbst. Bewusst so entschieden (siehe Decision Log); der Betreiber
   erfährt in diesem Fall am letzten Tag, dass jemand geht.
2. **Ferien verschieben die Frist mit.** Z verschiebt sich um die Ferientage, F ist der
   letzte Sonntag davor — die Frist wandert also mit der Schließung nach hinten.
3. **Ferien werden nachträglich eingetragen.** Ein schon gespeichertes
   `pending_effective_date` wandert nicht mehr; der Einzug schon. Beides kann dann um Tage
   auseinanderliegen. Hinnehmbar, weil ein bestätigtes Datum nicht nachträglich verschoben
   werden darf — aber es gehört in die Betriebsnotiz.
4. **Kündigung zurücknehmen und neu kündigen.** Nimmt der Kunde nach Ablauf der Frist seine
   Kündigung zurück und kündigt erneut, bekommt er das spätere Datum. Das ist richtig, aber
   überraschend; die Zeile muss es benennen.
5. **Kündigung um 23:30 Wiener Zeit am Stichtag.** Gilt noch. Gerechnet wird auf
   Kalendertagen in Wien (`heute_wien()`), nicht in UTC — sonst wäre die Frist im Sommer um
   zwei Stunden früher vorbei.
6. **Abo wurde im laufenden Zyklus erst angelegt.** Kein Einzug, kein Vorzyklus: Z rechnet
   vom Anker, und die Frist kann wenige Tage nach dem Abschluss liegen.
7. **Zwei Einzüge im selben Zyklus** (Nachbuchung, Korrektur). Z muss vom **jüngsten**
   Einzug rechnen, der zu diesem Zyklus gehört, nicht von jedem.

## Umsetzung (2026-11-04)

### Was gebaut wurde

| Stelle | Änderung |
| --- | --- |
| `20261104160000_proj96_kuendigungsfrist.sql` | Drei Funktionen: `ferientage_zwischen` und `naechste_faelligkeit` spiegeln die TypeScript-Rechnung, `abo_kuendigungsfenster` liefert Zyklusschluss, Frist und Wirksamkeitsdatum. `self_schedule_subscription_change` nimmt sein Datum von dort statt aus `next_cycle_end`. |
| `src/app/[locale]/(site)/profil/page.tsx` | Fragt das Fenster je aktivem Abo ohne geplante Änderung ab; ohne Antwort fehlt nur der Hinweis, nicht die Möglichkeit |
| `src/components/subscription/my-subscriptions-section.tsx` | Die Zeile am Abo, der Dialogtext mit Datum, und ein Datumsformat nach Sprache |
| `messages/de.json`, `messages/en.json` | `cancelDeadline`, `cancelDeadlinePassed`, `cancelSubConfirmBodyDatum` |
| `src/components/legal/terms-de.tsx`, `terms-en.tsx` | Punkt 2 neu gefasst, Punkt 4 entschärft („jederzeit" ist raus) |
| `src/lib/faq/eintraege.ts` | **Befund beim Bauen:** Die FAQ behauptete dieselbe alte Regel wie die AGB — „jederzeit", „zum Ende des laufenden Zyklus". Vier Stellen, deutsch und englisch, mitgeändert. Ohne das hätte die App ihren eigenen Bedingungen an zwei Orten widersprochen statt an einem. |
| `src/lib/supabase/types.ts` | Die drei neuen Funktionen |

### Entscheidungen, die beim Bauen fielen

- **`while v_schluss < v_heute`, nicht `<=`.** Fällt der Zyklusschluss auf heute, bleibt er
  erreichbar. Das alte `next_cycle_end` sprang in diesem Fall einen Zyklus weiter — und
  genau dann wäre der Fall „Zyklusschluss an einem Sonntag" nicht mehr kündbar, obwohl die
  Frist derselbe Tag ist.
- **Ein eigenes Datumsformat für den Stichtag.** `formatDate` in der Datei schreibt immer
  österreichisch. Für eine Frist geht das nicht: Im englischen Kundenbereich liest „09.11.2026"
  jemand als 9. November oder als 11. September, und das ist der Unterschied zwischen
  rechtzeitig und zu spät.
- **Der Dialog fällt auf den alten Satz zurück**, wenn das Fenster nicht lesbar war. Besser
  ein unscharfer Satz als ein Dialog mit einer Leerstelle, wo ein Datum stehen sollte.

### Prüfungen

| Prüfung | Umfang |
| --- | --- |
| `tests/PROJ-96-kuendigungsfrist-db.test.ts` | 11 Fälle, angemeldet als Kunde: Parität zu TypeScript (zwei Funktionen), die Frist über **alle 28 Wochentagslagen**, Sonntagsschluss, Ferienverschiebung, Anker ohne Einzug, Einzug aus einem Entwurf, Kündigen und Pausieren, zwei Abweisungen |
| `tests/PROJ-96-kuendigungsfrist.spec.ts` | 6 Fälle im Browser: Zeile vor der Frist, Dialog mit Datum, Zeile nach Ablauf, englische Fassung, zwei Abos mit eigenen Stichtagen, geplante Änderung ohne Stichtag |

Vor dem Einspielen der Migration scheitern alle 11 Datenbankfälle mit „Could not find the
function public.abo_kuendigungsfenster" — der Beweis, dass sie die Migration prüfen und nicht
an ihr vorbei.

## QA (2026-11-05)

Die Migration liegt seit dem 4. November in der Testdatenbank. Danach gelaufen:

| Lauf | Ergebnis |
| --- | --- |
| `tests/PROJ-96-kuendigungsfrist-db.test.ts` | **11/11** |
| `tests/PROJ-96-kuendigungsfrist.spec.ts` | **12/12** (6 Fälle × 2 Browser) |
| PROJ-80, PROJ-87 und `src/lib/sepa` | **130/130** |
| PROJ-9, PROJ-70, PROJ-51, PROJ-43 im Browser | **128/128** |
| `npx vitest run src/lib` | 1079/1079 |
| `tsc --noEmit`, `eslint` | sauber |

PROJ-80 ist hier der wichtigste Regressionslauf: Er ruft genau die geänderte Funktion
`self_schedule_subscription_change` mit Grund und Notiz auf.

### Zwei Kriterien hatten keinen Test — nachgeholt

Beim Abgleich der Kriterien gegen die Tests fehlten zwei Prüfungen. Beide sind jetzt da:

- **Jedes Abo trägt seinen eigenen Stichtag.** Mit einem einzigen Testabo wäre ein Fehler
  unsichtbar, der einen Stichtag für alle Abos anzeigt — die Angabe steht in einer Zuordnung
  je Abo, und genau solche Zuordnungen verwechseln sich. Jetzt stehen zwei Abos mit
  verschieden endenden Zyklen in derselben Liste.
- **Eine geplante Änderung behält ihr Datum.** Geprüft mit einem zugesagten Datum, das die
  neue Rechnung nie liefern würde (99 Tage). Käme es neu gerechnet heraus, wäre das ein
  nachträglich verschobenes Zusagedatum — der Vertrauensbruch, den die Frist verhindern soll.

### Zehn Fehlschläge, alle im Test

Der erste Browserlauf war 0/8, der zweite 6/8. Keiner der Fehlschläge lag in der App:

- Der Helfer suchte die Klappe mit `/^Mein Abo$/`. Ihr barrierefreier Name trägt den
  Untertitel mit: „Mein Abo Pausieren, kündigen oder umbuchen“. Anker entfernt.
- Der Dialog wurde mit „Abbrechen“ geschlossen. Der Knopf heißt „Abo behalten“ — und das
  ist richtig so: „Abbrechen“ neben „Ja, kündigen“ wäre zweimal dasselbe Wort für zwei
  Gegenteile.

Der zweite ist der lehrreichere: Die eigentliche Zusicherung dieses Falls — der Dialog nennt
den Zyklusschluss — war schon grün, die Prüfung scheiterte erst eine Zeile später beim
Aufräumen.

### Was ohne Test bleibt

| Kriterium | Wie belegt |
| --- | --- |
| Die Verwaltung wird von der Frist nicht gehindert | Durch Lesen: `src/lib/actions/admin/subscriptions.ts` schreibt direkt und ruft `abo_kuendigungsfenster` nicht auf. Ein Test dafür bräuchte den Verwaltungsweg samt zweiter Stufe — siehe Open Questions. |
| AGB Punkt 2, deutsch und englisch | Durch Lesen beider Fassungen. Rechtlich prüft der Betreiber (Decision Log). |

Dazu geprüft, ohne Test: `next_cycle_end` hat im Code **keine Aufrufer mehr** — nur noch die
Typdatei und die alten Migrationen. Und alle 60 E2E-Abos in der Testdatenbank haben einen
Anker, kein Fixture fällt also in den Fall „ohne Anker“.

### Urteil

Produktionsreif. Keine Fehler der Schwere Kritisch oder Hoch. Die Migration muss **vor** dem
Ausliefern in der Produktion liegen: Das Profil liest die neue Funktion bei jedem Aufruf.

## Tech Design (Solution Architect)

### Was gerechnet wird

Drei Angaben, aus **einer** Quelle in der Datenbank:

| Angabe | Woraus |
| --- | --- |
| **Zyklusschluss** | Letzter Einzug dieses Abos, plus vier Wochen, plus die Ferientage, die dazwischen liegen. Gibt es noch keinen Einzug, zählt der Anker des Abos. Liegt das Ergebnis in der Vergangenheit — ein lange nicht eingezogenes Abo —, wird weitergerechnet, bis es in der Zukunft liegt. |
| **Frist** | Der letzte Sonntag auf oder vor dem Zyklusschluss. |
| **Wirksam zum** | Bis einschließlich Frist: der Zyklusschluss. Danach: der nächste. |

Das Nachrechnen ist kein Schönheitsfehler, sondern nötig: Schiebt eine Ferienwoche den
Zyklusschluss nach hinten, kann im neuen Fenster eine weitere Ferienwoche liegen. Genau so
rechnet der Einzug heute schon.

Als „letzter Einzug" zählt der jüngste SEPA-Lauf, in dem dieses Abo steht — **auch ein
Entwurf.** Dieselbe Regel wie beim Einzug: Zwei offene Entwürfe zum selben Zyklus wären
sonst zwei Abbuchungen.

### Wer die Angabe benutzt

```
Kundenprofil
+-- Abo-Karte, aktiv, nichts geplant
|   +-- Zeile „Kündigung oder Pause bis …, wirkt zum …"        NEU
|   |   +-- nach Ablauf der Frist: „Frist abgelaufen, wirkt zum …"
|   +-- Knopf „Kündigen"  -> Dialog nennt dasselbe Datum       TEXT GEÄNDERT
|   +-- Knopf „Pausieren" -> dasselbe Datum                    TEXT GEÄNDERT
+-- Abo-Karte, Änderung geplant
    +-- unverändert: geplantes Datum, Knopf „Zurücknehmen"

Abo-Funktion in der Datenbank (Selbstbedienung)
+-- Kündigen und Pausieren holen das Wirksamkeitsdatum aus der
    neuen Rechnung statt aus dem starren 28-Tage-Raster

Verwaltung am Kunden
+-- unverändert. Dort wird direkt gespeichert, nicht über die
    Selbstbedienungs-Funktion — die Frist greift also von sich aus nicht.

AGB, Punkt 2 und 4
+-- deutsche und englische Fassung
```

### Datenmodell

**Keine neue Tabelle, keine neue Spalte.** Gelesen wird, was schon da ist: das Abo (Anker,
Status), die SEPA-Läufe mit ihrem Fälligkeitsdatum, und die Ferienzeiträume des Studios.

Gespeichert wird weiterhin nur das, was heute gespeichert wird: das Wirksamkeitsdatum im
Moment der Kündigung. Stichtag und Zyklusschluss werden **nicht** gespeichert — ein Datum,
das sich aus den Ferien ergibt, müsste bei jeder Ferienänderung nachgezogen werden, und wer
das einmal vergisst, hat einen stillen Fehler im Geld.

### Dependencies

Keine neuen Pakete.

### Was der Entwurf an Prüfungen verlangt

| Prüfung | Warum |
| --- | --- |
| Dieselbe Rechnung in SQL und TypeScript über dieselben Eingaben vergleichen | Die Regel existiert nach diesem Umbau an zwei Stellen. Befund 2 ist genau das, was dann passiert, wenn niemand sie vergleicht. |
| Datenbankprüfungen **angemeldet als Kunde**, nicht mit dem Dienstschlüssel | Der Dienstschlüssel umgeht Rechte und Richtlinien. Die Lehre aus PROJ-94: Neun grüne Prüfungen und trotzdem konnte niemand sein Profil speichern. |
| Fälle: bis Frist, nach Frist, Zyklusschluss an einem Sonntag, Ferienwoche im Zyklus, Abo ohne Einzug, Pause nach Frist | Jeder Randfall dieser Spezifikation, der nicht geprüft wird, ist eine Vermutung. |
| Browser: Zeile sichtbar, Text nach Ablauf, englische Fassung | Die Anzeige ist die Hälfte der Aufgabe. |
| Regression: SEPA-Lauf (PROJ-70/71), Vollziehen in der Verwaltung, Upgrade-Pfad (PROJ-91) | Alle drei lesen Zyklus und Wirksamkeitsdatum. |

## Decision Log

### Produkt

| Entscheidung | Begründung | Datum |
| --- | --- | --- |
| Die Kündigung rechnet künftig nach Unterrichtswochen, nicht nach 28 Kalendertagen | Entscheidung des Betreibers: dieselbe Rechnung wie beim Einzug. Zwei Rhythmen in einem Abo sind für den Kunden nicht erklärbar — das Profil nennt heute ein Zyklusende, an dem nicht abgebucht wird. | 2026-11-04 |
| Die Frist ist der letzte Sonntag **auf oder vor** dem Zyklusschluss | Der Wortlaut des Betreibers: „Sonntag der letzten Kurswoche". Die Alternative (der Sonntag **vor** der letzten Woche) hätte immer 7–13 Tage Vorlauf gegeben, wäre aber eine Woche strenger als angekündigt. Der Preis ist bekannt und angenommen: Endet der Zyklus an einem Sonntag, bleibt kein Vorlauf. | 2026-11-04 |
| Nach der Frist wird die Kündigung **angenommen** und wirkt einen Zyklus später | Ein gesperrter Knopf zwingt den Kunden, ein zweites Mal zu kommen, und widerspricht dem AGB-Satz „jederzeit" direkt. Eine angenommene Kündigung mit späterem Datum ist die übliche Kündigungsfrist und braucht keinen zweiten Besuch. | 2026-11-04 |
| Dieselbe Frist für das Pausieren | Sonst ist die Pause das Schlupfloch: erst pausieren, dann aus der Pause kündigen. Außerdem kostet eine Pause denselben nicht einkalkulierten Platz. | 2026-11-04 |
| Der Stichtag steht **immer** an jedem aktiven Abo | Wer vier Wochen vorher plant, soll die Angabe finden, bevor er sie braucht. Eine Zeile, die erst in der letzten Woche erscheint, hilft nur dem, der zufällig in dieser Woche nachsieht. | 2026-11-04 |
| Die Verwaltung bleibt ungebunden | Kulanz muss möglich sein, ohne in der Datenbank zu schrauben. Die Frist ist eine Regel der Selbstbedienung, nicht des Betriebs. | 2026-11-04 |
| Geplante Änderungen werden nicht neu berechnet | Ein Datum, das ein Kunde bestätigt bekommen hat, wird nicht nachträglich verschoben — auch nicht um zwei Tage. | 2026-11-04 |
| Die AGB werden mitgeändert, der Betreiber prüft rechtlich | Eine App, die ihren eigenen Bedingungen widerspricht, ist bei Geld der schlechtere Fehler. Ob die Frist bei **Bestandskunden** einseitig eingeführt werden darf, ist eine Rechtsfrage und keine Entwicklungsfrage. | 2026-11-04 |

### Technisch

| Entscheidung | Begründung | Datum |
| --- | --- | --- |
| Die ferienbewusste Rechnung kommt in die **Datenbank**, nicht in die Serveraktion | `pending_effective_date` wird heute in einer `security definer`-Funktion gesetzt. Käme das Datum aus dem Client, müsste die Funktion es ohnehin nachrechnen, um es zu prüfen — dann lieber nur dort. | 2026-11-04 |
| Die SQL-Rechnung braucht einen Test **gegen** `naechsteFaelligkeit` | Dieselbe Regel an zwei Stellen driftet, sobald eine angefasst wird (Befund 2 ist genau das). Ein Test, der beide Implementierungen über dieselben Eingaben vergleicht, fängt das. | 2026-11-04 |
| Eine Funktion liefert alle drei Angaben, nicht drei Funktionen | Zyklusschluss, Frist und Wirksamkeitsdatum sind eine Frage mit drei Teilen. Getrennt gerechnet driften sie beim ersten Umbau auseinander — und dann zeigt das Profil einen anderen Stichtag als die Funktion, die ihn durchsetzt. | 2026-11-04 |
| Die Anzeige im Profil kommt aus derselben Quelle wie die Wirkung | Eine zweite Rechnung im Frontend wäre eine zweite Wahrheit. Das Profil soll nicht erklären, was es selbst gerechnet hat, sondern was gilt. | 2026-11-04 |
| Stichtag und Zyklusschluss werden nicht gespeichert | Beide hängen an den Ferien. Eine gespeicherte Spalte müsste bei jeder Ferienänderung nachgezogen werden; wer das vergisst, hat einen stillen Fehler im Geld. Gerechnet wird in Millisekunden. | 2026-11-04 |
| Der SEPA-Lauf wird **nicht** auf die neue SQL-Rechnung umgestellt | Das wäre der saubere Weg gegen die doppelte Regel, aber der Lauf bewegt Geld. Ein Umbau dort gehört in einen eigenen Schritt mit eigener Prüfung, nicht als Beifang hier. Bis dahin hält der Paritätstest beide zusammen. | 2026-11-04 |
| `next_cycle_end` wird nicht gelöscht, sondern verliert seine Aufrufer | Die Funktion steht in drei Migrationen und ist über `types.ts` nach außen sichtbar. Ersetzen, ohne den alten Namen wegzureißen, hält die Migration klein und rückholbar. | 2026-11-04 |

## Open Questions

- [x] **Soll es eine Erinnerung vor Ablauf der Frist geben?** → **Nein.** Entscheidung des
      Betreibers: Eine Nachricht, die jeden Kunden regelmäßig an seine Kündigungsmöglichkeit
      erinnert, soll es nicht geben. Der Stichtag steht im Profil, das genügt. (2026-11-04)
- [x] **Darf die Frist bei Bestandskunden gelten?** → **Ja, die Frist gilt für alle.**
      Entscheidung des Betreibers, nachdem der Widerspruch zum AGB-Satz „jederzeit" benannt
      war: Eine gesonderte rechtliche Prüfung für Bestandskunden ist nicht geplant, die AGB
      werden mit der Änderung angepasst. Festgehalten, weil die Frage gestellt und bewusst
      beantwortet wurde — nicht übersehen. (2026-11-04)
- [ ] **Soll PROJ-91 (`flatrate_upgrade_zyklus_wird_abgebucht`) auf dieselbe Rechnung
      umgestellt werden?** Dort steckt dasselbe 28-Tage-Fenster. Nicht Teil dieser
      Spezifikation, aber derselbe Befund.
- [ ] **Soll der Verwaltungsweg einen eigenen Test bekommen?** Dass der Betreiber nicht an
      die Frist gebunden ist, steht heute nur im Code: Die Verwaltung schreibt direkt, statt
      die Funktion zu rufen. Stellt eine spätere Änderung sie auf die Funktion um, wäre der
      Betreiber still mitgebunden — und nichts würde rot. Ein Test dafür braucht den
      Verwaltungsweg samt zweiter Stufe, deshalb hier nicht mehr gebaut. (2026-11-05)
