# PROJ-48: Buchungen nach Status filtern und stapelweise bearbeiten

## Status: Architected

**Priorität:** P1 — spart täglich Klicks, bewegt aber kein Geld ohne Zutun
**Erstellt:** 2026-09-06

## Dependencies

- Setzt voraus: PROJ-4 (Kunden- und Buchungsverwaltung) — die Buchungsliste
- Setzt voraus: PROJ-15 (Gutscheine) — der Preisvorschlag berücksichtigt sie
- Setzt voraus: PROJ-41 (Preise bei der Kursbuchung) — der Vorschlag stammt
  aus dem bei der Anfrage gezeigten Preis
- Berührt: PROJ-16 (Benachrichtigungen) — jede bearbeitete Buchung erzeugt eine
- Berührt: PROJ-12 (Warteliste) — eine abgelehnte Anfrage rückt sie nach

## Problemstellung

Die Buchungsseite zeigt alles: offene Anfragen zwischen bestätigten,
abgelehnten und stornierten. Es gibt einen Filter nach **Art**, aber keinen
nach **Status**. Mit jedem Monat wächst die Liste, und das, was Arbeit
verlangt, steht zwischen dem, was längst erledigt ist.

Und jede Buchung wird einzeln bearbeitet. Nach einem Wochenende mit zehn
Anmeldungen sind das zehn Durchgänge durch denselben Ablauf — obwohl der
Betreiber in den meisten Fällen genau das bestätigt, was ohnehin vorgeschlagen
wird.

## Was „bestätigen" je nach Art bedeutet

Das ist der Kern dieses Vorhabens, und es ist nicht überall dasselbe:

| Art | Beim Bestätigen passiert |
|---|---|
| **Drop-in** | Nur der Statuswechsel, plus Nachricht an den Kunden |
| **Buchungsanfrage** | Es entsteht ein **Abo** mit Namen und Preis; ein hinterlegter Gutschein wird eingelöst |
| **Probestunde** | Kommt nicht vor — Probestunden entstehen bereits bestätigt |

Ein Stapel über Buchungsanfragen legt also Abos an, die jeden Monat abbuchen.
Das ist der Grund, warum die Vorschläge vor dem Ausführen sichtbar sein müssen.

**Ablehnen** ist dagegen bei jeder Art ein reiner Statuswechsel und damit ohne
Weiteres stapelbar.

## User Stories

- **Als Betreiber** möchte ich beim Öffnen der Seite sehen, was noch auf mich
  wartet, statt es zwischen Erledigtem zu suchen.
- **Als Betreiber** möchte ich nach Status filtern können, um auch gezielt
  Abgelehntes oder Storniertes nachzusehen.
- **Als Betreiber** möchte ich mehrere Buchungen auswählen und gemeinsam
  bestätigen, weil ich in den meisten Fällen ohnehin den Vorschlag übernehme.
- **Als Betreiber** möchte ich vor dem Bestätigen sehen, welche Abos mit
  welchen Preisen entstehen — die buchen jeden Monat ab.
- **Als Betreiber** möchte ich mehrere Buchungen gemeinsam ablehnen.
- **Als Betreiber** möchte ich nach einem Stapel wissen, was durchging und was
  nicht, statt einer Meldung, die nur „erledigt" sagt.

## Umfang

### Statusfilter

Ein zweiter Filter neben dem bestehenden nach Art, mit denselben Werten wie die
Statusanzeige: Offen, Bestätigt, Abgelehnt, Storniert, sowie „Alle".

**Die Seite öffnet gefiltert auf „Offen".** Das ist die Arbeit, die wartet.
Damit niemand glaubt, es gäbe nur diese, nennt ein Hinweis unter der Liste die
Gesamtzahl und den aktiven Filter.

### Auswahl und Stapel

Ein Auswahlkästchen je Zeile, dazu eines im Tabellenkopf für „alle
angezeigten". Ausgewählt werden können nur offene Buchungen — alles andere ist
bereits bearbeitet.

**Stapelweise bestätigen** übernimmt je Buchung den Vorschlag, den der
Einzeldialog heute schon macht: den Kursnamen als Abo-Namen und den bei der
Anfrage gezeigten Preis, abzüglich eines gültigen Gutscheins. Vor dem Ausführen
zeigt eine Liste, welche Abos mit welchen Namen und Preisen entstehen. Wer
abweichen will, bestätigt diese Buchung einzeln wie bisher.

**Stapelweise ablehnen** wechselt den Status und benachrichtigt; bei
Buchungsanfragen rückt die Warteliste nach, genau wie beim einzelnen Ablehnen.

### Was nach dem Stapel passiert

Der Vorgang läuft weiter, wenn eine einzelne Buchung scheitert, und berichtet
danach ehrlich: wie viele durchgingen, welche nicht und warum. Alles
zurückzurollen wäre falsch — jede Buchung ist ein eigener Kunde mit einem
eigenen Abo, und eine veraltete Zeile darf zwanzig gute nicht blockieren.

## Out of Scope

- **Stapelweise Preise ändern.** Wer einen anderen Preis will, bestätigt
  einzeln — dort steht das Feld.
- **Stornieren im Stapel.** Storniert wird eine bereits bestätigte Buchung, und
  das hat Folgen für Abo und Rechnung. Ein eigener Vorgang, kein Stapel.
- **Probestunden bestätigen.** Sie entstehen bereits bestätigt.
- **Seitenweises Blättern.** Die Liste ist heute vollständig; Blättern steht als
  eigenes Vorhaben in der PRD.
- **Auswahl über Filterwechsel hinweg merken.** Wer den Filter wechselt, sieht
  eine andere Menge; eine mitgeschleppte Auswahl wäre unsichtbar und gefährlich.

## Acceptance Criteria

### Statusfilter

- [ ] Angenommen der Betreiber öffnet die Buchungsseite, wenn sie lädt, dann sind nur offene Buchungen zu sehen und der Statusfilter steht auf „Offen"
- [ ] Angenommen der Filter steht auf „Offen", wenn der Betreiber die Liste ansieht, dann nennt ein Hinweis die Gesamtzahl aller Buchungen und den aktiven Filter
- [ ] Angenommen der Betreiber wählt einen anderen Status, wenn die Liste neu lädt, dann enthält sie ausschließlich Buchungen mit diesem Status
- [ ] Angenommen der Betreiber wählt „Alle", wenn die Liste neu lädt, dann enthält sie Buchungen jedes Status
- [ ] Angenommen Status- und Artfilter sind beide gesetzt, wenn die Liste lädt, dann wirken beide gemeinsam
- [ ] Angenommen ein Filter ist gesetzt, wenn der Betreiber sortiert, dann bleibt der Filter erhalten

### Auswahl

- [ ] Angenommen die Liste zeigt offene Buchungen, wenn der Betreiber eine Zeile auswählt, dann erscheinen die Stapelaktionen mit der Anzahl der gewählten Buchungen
- [ ] Angenommen der Betreiber wählt im Tabellenkopf „alle", wenn er das tut, dann sind alle angezeigten offenen Buchungen gewählt
- [ ] Angenommen eine Buchung ist nicht offen, wenn der Betreiber die Liste ansieht, dann lässt sie sich nicht auswählen
- [ ] Angenommen eine Auswahl besteht, wenn der Betreiber den Filter wechselt, dann ist die Auswahl leer
- [ ] Angenommen keine Buchung ist gewählt, wenn der Betreiber die Seite ansieht, dann sind die Stapelaktionen nicht auslösbar

### Stapelweise bestätigen

- [ ] Angenommen der Betreiber hat Buchungen gewählt, wenn er „Bestätigen" drückt, dann zeigt eine Liste je Buchung Kunde, Abo-Name und Preis, bevor etwas geschieht
- [ ] Angenommen die Liste erscheint, wenn eine Buchung einen gültigen Gutschein hat, dann ist der Preis bereits rabattiert und der Gutschein ausgewiesen
- [ ] Angenommen der Betreiber bestätigt den Stapel, wenn er abgeschlossen ist, dann existiert für jede Buchungsanfrage ein Abo mit dem angezeigten Namen und Preis
- [ ] Angenommen im Stapel sind Drop-ins, wenn er abgeschlossen ist, dann sind sie bestätigt, ohne dass ein Abo entstanden ist
- [ ] Angenommen jede bestätigte Buchung erzeugt eine Nachricht, wenn der Stapel abgeschlossen ist, dann steht für jede eine in der Warteschlange
- [ ] Angenommen eine Buchung im Stapel ist nicht mehr offen, wenn er ausgeführt wird, dann werden die übrigen trotzdem bearbeitet und das Ergebnis nennt die übersprungene

### Stapelweise ablehnen

- [ ] Angenommen der Betreiber hat Buchungen gewählt, wenn er „Ablehnen" drückt, dann erscheint eine Rückfrage mit der Anzahl
- [ ] Angenommen der Betreiber bestätigt, wenn der Stapel abgeschlossen ist, dann stehen alle gewählten Buchungen auf „Abgelehnt" und jeder Kunde hat eine Nachricht
- [ ] Angenommen unter den abgelehnten sind Buchungsanfragen zu einem Kurs, wenn der Stapel abgeschlossen ist, dann ist die Warteliste dieses Kurses nachgerückt

### Ergebnis

- [ ] Angenommen ein Stapel ist abgeschlossen, wenn das Ergebnis erscheint, dann nennt es die Zahl der erfolgreich bearbeiteten und der übersprungenen Buchungen
- [ ] Angenommen einzelne Buchungen wurden übersprungen, wenn das Ergebnis erscheint, dann ist je Buchung erkennbar, welche und warum
- [ ] Angenommen ein Stapel ist abgeschlossen, wenn die Liste neu lädt, dann sind die bearbeiteten Buchungen aus der Offen-Ansicht verschwunden

### Rechte

- [ ] Angenommen ein Kunde ruft eine Stapelfunktion direkt über die Schnittstelle auf, wenn er kein Admin ist, dann wird der Aufruf abgewiesen
- [ ] Angenommen eine Lehrkraft ruft sie auf, wenn sie kein Admin ist, dann wird der Aufruf ebenfalls abgewiesen

## Edge Cases

- **Eine gewählte Buchung wurde inzwischen anderswo bearbeitet.** Sie wird
  übersprungen, nicht überschrieben, und im Ergebnis genannt.
- **Der Kurs hat keinen Preis hinterlegt.** Dann gibt es keinen Vorschlag. Die
  Buchung darf nicht mit Preis 0 durchrutschen — sie wird in der Vorschau
  ausgewiesen und muss einzeln bestätigt werden.
- **Der Gutschein ist zwischen Anfrage und Bestätigung abgelaufen.** Der Preis
  in der Vorschau ist dann der unrabattierte; die Vorschau ist der Stand von
  jetzt, nicht der von damals.
- **Ein Kunde hat mehrere offene Anfragen im Stapel.** Jede wird einzeln
  behandelt; es entstehen mehrere Abos. Das ist richtig — jemand kann zwei
  Kurse buchen.
- **Sehr großer Stapel.** Jede Buchung erzeugt eine Nachricht. Der Vorgang darf
  daran nicht auflaufen (siehe Technical Requirements).
- **Alle Buchungen im Stapel scheitern.** Das Ergebnis sagt das deutlich, statt
  einen Erfolg zu melden, den es nicht gab.
- **Der Betreiber wählt aus und lässt die Seite offen liegen**, während jemand
  anders bearbeitet. Beim Ausführen fällt das auf; siehe oben.

## Technical Requirements

- **Der Versand darf den Stapel nicht aufhalten.** `enqueueAndDispatch`
  verschickt sofort und ist im Code ausdrücklich als „nicht für Stapel
  geeignet" gekennzeichnet. Ein Stapel muss den einreihenden Weg nehmen, den
  der Cron-Lauf leert — sonst wartet die Anfrage auf zwanzig E-Mail-Versuche.
- Der Preisvorschlag muss **je Buchung** ermittelt werden und darf nicht aus
  der Auswahl heraus vereinheitlicht werden.
- Die Prüfung „ist noch offen" gehört an jede einzelne Buchung, nicht an den
  Stapel — sonst überschreibt ein veralteter Bildschirm fremde Arbeit.
- Der bestehende Einzelweg bleibt unverändert bestehen.

## Open Questions

- [x] Soll es eine Obergrenze für die Stapelgröße geben? → Ja, **50**. Ein
      Wochenende bringt bestenfalls zwanzig Anmeldungen; 50 lässt jeden echten
      Fall zu und fängt das versehentliche „alle auswählen" über eine Liste ab,
      die nach zwei Jahren mehrere hundert Zeilen hat. Wird sie überschritten,
      sagt die Oberfläche das, bevor etwas geschieht. (2026-09-06, Architektur)
- [x] Soll das Ergebnis eines Stapels nachlesbar bleiben? → Nein, die Meldung
      genügt. Was geschehen ist, steht anschließend in der Liste selbst; ein
      zweites Protokoll wäre eine zweite Wahrheit. (2026-09-06, Architektur)
- [ ] Beim stapelweisen Ablehnen rückt die Warteliste je betroffenem Kurs nach.
      Werden mehrere Anfragen **desselben** Kurses abgelehnt, geschieht das
      mehrfach hintereinander. Ob das genügt oder je Kurs einmal am Ende
      laufen sollte, ist in `/backend` am tatsächlichen Verhalten zu
      entscheiden — die Nachrückfunktion ist vorhanden und wird hier nicht
      geändert.

## Decision Log

### Product Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Die Seite öffnet auf „Offen" statt auf „Alle" | Das ist die Arbeit, die wartet. Die Liste wächst mit jedem Monat, und Offenes zwischen Erledigtem zu suchen ist genau der Aufwand, den dieses Vorhaben abschaffen soll. Ein Hinweis nennt die Gesamtzahl, damit niemand glaubt, es gäbe nur diese. | 2026-09-06 |
| Die Sammelbestätigung übernimmt die vorhandenen Vorschläge | Der Einzeldialog schlägt heute schon Kursname und den bei der Anfrage gezeigten Preis vor, Gutschein eingerechnet. In den meisten Fällen wird genau das bestätigt. Ein gemeinsamer Preis für alle Gewählten wäre schneller, aber ein Versehen legte mehrere falsche Abos an — und jedes bucht monatlich ab. | 2026-09-06 |
| Vor dem Ausführen zeigt eine Liste, was entsteht | Ein Stapel über Buchungsanfragen legt Abos an. Was jeden Monat Geld bewegt, darf nicht hinter einem Knopf verschwinden. | 2026-09-06 |
| Ein Stapel läuft weiter, wenn eine Buchung scheitert | Jede Buchung ist ein eigener Kunde mit eigenem Abo. Eine veraltete Zeile darf zwanzig gute nicht blockieren. Dafür muss das Ergebnis ehrlich sein: wie viele durchgingen, welche nicht und warum. | 2026-09-06 |
| Nur offene Buchungen sind auswählbar | Alles andere ist bearbeitet. Eine Auswahl, die nichts bewirkt, ist eine Falle. | 2026-09-06 |
| Die Auswahl wird beim Filterwechsel geleert | Wer den Filter wechselt, sieht eine andere Menge. Eine mitgeschleppte, unsichtbare Auswahl wäre gefährlich. | 2026-09-06 |
| Kein Stapel-Stornieren | Storniert wird eine bereits bestätigte Buchung, und das hat Folgen für Abo und Rechnung. Ein eigener Vorgang. | 2026-09-06 |

### Technical Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Kein neues Feld, keine Migration | Der Status steht bereits an der Buchung, der Preisvorschlag wird berechnet. Was nichts speichert, kann nicht auseinanderlaufen. | 2026-09-06 |
| Der Statusfilter steht in der Adresszeile | Art, Sortierung und Richtung stehen dort schon. Die Ansicht bleibt verlinkbar, uebersteht das Neuladen, und Sortieren verliert den Filter nicht. | 2026-09-06 |
| Fehlt der Filter, gilt "Offen" -- "Alle" ist ein ausdruecklicher Wert | Der schlichte Aufruf der Seite zeigt damit die wartende Arbeit. Die Asymmetrie zur Art ist gewollt: Bei der Art bedeutet keine Auswahl "alle", weil keine Art fuer sich Arbeit bedeutet. | 2026-09-06 |
| Der Stapel fuehrt den Einzelweg je Buchung aus, statt einen eigenen Vorgang ueber alle zu sein | Der ehrliche Bericht ergibt sich von selbst, ein veralteter Bildschirm ueberschreibt keine fremde Arbeit, und es gibt keinen zweiten Ort mit denselben Regeln. | 2026-09-06 |
| Die Oberflaeche schickt Name und Preis mit, der Server rechnet sie nicht neu | Rechnete er neu, koennte zwischen Ansehen und Bestaetigen ein Gutschein ablaufen -- und es entstuende ein Abo zu einem Preis, den niemand gesehen hat. Geprueft werden die Werte trotzdem, mit derselben Obergrenze wie im Einzeldialog. | 2026-09-06 |
| Nachrichten werden eingereiht statt sofort verschickt | Der sofortige Weg ist im Code ausdruecklich als nicht fuer Stapel geeignet gekennzeichnet: Zwanzig E-Mail-Versuche nacheinander liessen die Anfrage auflaufen. Der Cron-Lauf leert die Warteschlange ohnehin. | 2026-09-06 |
| Die Auswahl wird beim Filterwechsel ausdruecklich geleert, nicht der Navigation ueberlassen | Die Oberflaeche kann ihren Zustand ueber eine Navigation hinweg behalten. Eine unsichtbare Auswahl auf einer anderen Menge waere genau die Falle, die dieses Vorhaben vermeiden soll. | 2026-09-06 |
| Obergrenze 50 je Stapel | Ein Wochenende bringt bestenfalls zwanzig Anmeldungen. 50 laesst jeden echten Fall zu und faengt das versehentliche "alle auswaehlen" ueber eine Liste ab, die nach zwei Jahren mehrere hundert Zeilen hat. | 2026-09-06 |

## Tech Design (Solution Architect)

### Der tragende Gedanke

Dieses Vorhaben speichert **nichts Neues**. Der Status steht längst an jeder
Buchung, und der Preisvorschlag wird berechnet, nicht abgelegt. Was
dazukommt, ist ein zweiter Filter, eine Auswahl und ein Vorgang, der den
vorhandenen Einzelweg wiederholt ausführt.

Das ist auch die wichtigste Entscheidung: **Der Stapel ist kein eigener
Vorgang über alle, sondern derselbe Vorgang je Buchung, hintereinander.** Eine
Sammelbestätigung, die ihre eigene Logik mitbringt, wäre ein zweiter Weg mit
denselben Regeln — und zwei Wege mit denselben Regeln laufen auseinander.

### A) Aufbau der Oberfläche

```
Buchungen (Seite)
├── Preisliste                             (unverändert)
└── Buchungsverwaltung
    ├── Filterzeile
    │   ├── Art                            (vorhanden)
    │   ├── Status                         ← neu, Vorgabe „Offen"
    │   └── Filter zurücksetzen
    │
    ├── Stapelleiste                       ← neu, erscheint erst bei Auswahl
    │   └── „3 gewählt"  [Bestätigen] [Ablehnen] [Auswahl aufheben]
    │
    ├── Tabelle
    │   ├── Kopfzeile: Auswahlkästchen „alle angezeigten"   ← neu
    │   └── je Zeile:  Auswahlkästchen, nur bei „Offen"     ← neu
    │       └── Einzelaktionen Bestätigen/Ablehnen  (unverändert)
    │
    ├── Hinweiszeile                       ← neu
    │       „3 von 47 Buchungen — Filter: Offen"
    │
    ├── Vorschau „Diese Abos entstehen"    ← neu
    ├── Rückfrage „N Buchungen ablehnen?"  ← neu
    └── Ergebnismeldung                    ← neu
```

Im ganzen Verwaltungsbereich gibt es bisher **keine Stapel-Auswahl**. Diese
wäre die erste — das Auswahlkästchen als Baustein ist vorhanden, das Muster
darüber nicht.

### B) Welche Informationen dazukommen

**Keine.** Weder an der Buchung noch sonstwo entsteht ein neues Feld, und es
gibt keine Migration.

- Der **Status** steht bereits an der Buchung, mit denselben vier Werten, die
  die Anzeige schon benutzt.
- Der **Vorschlag** für Abo-Name und Preis wird aus dem berechnet, was die
  Zeile ohnehin mitbringt: Kursname, der bei der Anfrage gezeigte Preis, und
  ein Gutschein, sofern er noch gilt. Genau diese Rechnung macht der
  Einzeldialog heute schon.
- Das **Ergebnis** eines Stapels wird gemeldet, nicht abgelegt. Was geschehen
  ist, steht anschließend in der Liste selbst.

### C) Technische Entscheidungen und warum

**Der Statusfilter gehört in die Adresszeile, nicht in den Bildschirmzustand.**
Art, Sortierung und Richtung stehen dort bereits. Damit bleibt eine gefilterte
Ansicht verlinkbar, übersteht das Neuladen, und das Sortieren verliert den
Filter nicht — das war bei PROJ-33 schon der Grund.

**Fehlt der Filter in der Adresse, gilt „Offen".**
Der schlichte Aufruf der Seite zeigt damit die Arbeit, die wartet. „Alle" ist
ein ausdrücklicher Wert, kein Weglassen. Die Asymmetrie zur Art — dort heißt
Weglassen „alle" — ist gewollt: Bei der Art gibt es keine, die Arbeit
bedeutet, beim Status schon.

**Der Stapel führt den Einzelweg je Buchung aus.**
Er prüft für jede einzeln, ob sie noch offen ist, und behandelt sie nach ihrer
Art. Das kostet mehr Schritte als ein Vorgang über alle, bringt aber drei
Dinge mit: Der ehrliche Bericht ergibt sich von selbst, ein veralteter
Bildschirm überschreibt keine fremde Arbeit, und es gibt keinen zweiten Ort,
an dem dieselben Regeln stehen.

**Was in der Vorschau steht, wird auch ausgeführt.**
Die Oberfläche schickt Name und Preis mit, statt den Server neu rechnen zu
lassen. Rechnete er neu, könnte zwischen Ansehen und Bestätigen ein Gutschein
ablaufen — und es entstünde ein Abo zu einem Preis, den niemand gesehen hat.
Geprüft werden die Werte trotzdem, mit derselben Obergrenze wie im
Einzeldialog.

**Die Nachrichten werden eingereiht, nicht sofort verschickt.**
Der Einzelweg verschickt sofort, damit der eine Kunde seine Bestätigung gleich
bekommt. Für einen Stapel ist dieser Weg im Code ausdrücklich als ungeeignet
gekennzeichnet: Zwanzig E-Mail-Versuche nacheinander ließen die Anfrage
auflaufen. Der Stapel reiht ein; der bestehende Cron-Lauf leert die
Warteschlange wie bei den Lastschrift-Ankündigungen.

**Die Auswahl wird beim Filterwechsel ausdrücklich geleert.**
Ein Filterwechsel ist eine Navigation, aber darauf allein sollte man sich
nicht verlassen — die Oberfläche kann ihren Zustand über eine solche
Navigation hinweg behalten. Eine unsichtbare Auswahl auf einer anderen Menge
wäre genau die Falle, die dieses Vorhaben vermeiden soll.

**Eine Obergrenze für die Stapelgröße.**
Vorschlag: **50**. Ein Wochenende bringt bestenfalls zwanzig Anmeldungen; 50
lässt jeden echten Fall zu und fängt trotzdem das versehentliche „alle
auswählen" über eine Liste ab, die nach zwei Jahren mehrere hundert Zeilen
hat. Wird die Grenze überschritten, sagt die Oberfläche das, bevor etwas
geschieht.

**Der Einzelweg bleibt unverändert.**
Wer einen abweichenden Preis braucht, bestätigt wie bisher einzeln. Der Stapel
ist eine Abkürzung für den Regelfall, kein Ersatz.

### D) Neue Pakete

Keine. Auswahlkästchen, Tabelle, Dialog, Rückfrage, Meldung und die
Filtermechanik über die Adresszeile sind vorhanden.

### E) Aufwandseinschätzung

| Teil | Größe |
|---|---|
| Statusfilter samt Vorgabe „Offen" und Hinweiszeile | klein |
| Auswahl in der Tabelle, Stapelleiste | mittel |
| Vorschau vor dem Bestätigen | mittel |
| Stapelvorgänge samt ehrlichem Bericht | mittel |
| Umstellung des Versands auf den einreihenden Weg | klein |

Der heikelste Teil ist nicht der größte: Es ist die Vorschau. Sie ist die
einzige Stelle, an der der Betreiber sieht, welche monatlichen Abbuchungen er
gleich anlegt — was dort steht, muss stimmen.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
