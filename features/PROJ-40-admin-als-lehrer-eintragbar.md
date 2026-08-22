# PROJ-40: Admin auch als Lehrer eintragbar

## Status: Planned
**Created:** 2026-08-22
**Last Updated:** 2026-08-22

## Dependencies
- Requires: PROJ-3 (Admin: Kurse verwalten) — dort werden Lehrer einem Kurs zugewiesen.
- Requires: PROJ-13 (Lehrer-Ansicht) — liefert „Meine Kurse" und die Anwesenheitsmatrix.
- Requires: PROJ-22 (Admin: Lehrer-Rollen verwalten) — verwaltet heute den Wechsel zwischen Kunde und Lehrer.
- Requires: PROJ-5 (Kurskatalog) / PROJ-6 (Stundenplan) — zeigen den Lehrernamen auf den Kurskarten.

## Ausgangslage
Die Rolle ist ein **einzelnes Feld**: jemand ist entweder `customer`, `teacher` oder `admin`. Wer die
Schule führt **und** unterrichtet, passt in kein Feld. Praktische Folge heute: Der Betreiber hat sich
ein **zweites Konto** angelegt (`skgcrazyfrog@…` als Lehrer neben `samuelg.kramer@…` als Admin) und
muss zum Unterrichten das Konto wechseln.

Beim Versuch, die Mitinhaberin Lisa zum Admin zu machen, wurde daraus ein konkretes Risiko: Sie
unterrichtet „Salsa Beginner 1", und da die öffentliche Lehrer-Liste ausschließlich Personen mit der
Rolle `teacher` enthält, wäre ihr Name durch die Rollenänderung **von der öffentlichen Kurskarte
verschwunden**. Die Rollenänderung wurde deshalb bewusst nicht durchgeführt.

## User Stories
- Als Betreiber möchte ich mich selbst einem Kurs als Lehrer zuweisen können, ohne dafür ein zweites Konto zu brauchen.
- Als Betreiber möchte ich, dass mein Name auf der Kurskarte steht, wenn ich den Kurs unterrichte — Kunden interessiert die interne Rolle nicht.
- Als Betreiber, der selbst unterrichtet, möchte ich „Meine Kurse" nutzen können wie ein Lehrer.
- Als Mitinhaberin möchte ich Admin-Rechte bekommen können, ohne dass ich dadurch als Lehrerin von der Kursseite verschwinde.

## Out of Scope
- **Mehrfachrollen als allgemeines Konzept** (z.B. Kunde + Lehrer gleichzeitig, Rechte frei kombinierbar). Es geht ausschließlich darum, dass ein **Admin** zusätzlich unterrichten kann. Admins haben ohnehin bereits Zugriff auf alle Lehrer-Funktionen — es fehlt nur die *Zuweisung* und die *Sichtbarkeit*.
- **Kunden als Lehrer** zuweisen — dafür gibt es weiterhin den Rollenwechsel aus PROJ-22.
- **Zusammenlegen der beiden bestehenden Konten** des Betreibers. Das ist eine Daten-Aufräumaktion (Anwesenheiten, Kurszuweisungen, Notizen hängen am Zweitkonto) und wird nach diesem Feature separat entschieden — siehe Open Questions.
- **Lehrer zu Admin machen** über die Oberfläche. Die Rollenvergabe an Admins bleibt vorerst ein manueller Schritt in der Datenbank.
- **Lehrer-spezifische Anzeige für Admins einschränken** (z.B. Admin sieht nur „seine" Kurse). Admins behalten vollen Zugriff auf alles.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Zuweisung
- [ ] Angenommen ein Admin bearbeitet einen Kurs, wenn er die Lehrer-Auswahl öffnet, dann stehen dort **sowohl Lehrer als auch Admins** zur Auswahl.
- [ ] Angenommen ein Admin ist einem Kurs als Lehrer zugewiesen, wenn die Kursliste in der Verwaltung angezeigt wird, dann erscheint sein Name in der Lehrer-Spalte wie bei jedem anderen Lehrer.
- [ ] Angenommen ein Admin wird einem Kurs zugewiesen, wenn die Zuweisung gespeichert wird, dann bleibt seine Rolle unverändert `admin` — er verliert keine Verwaltungsrechte.
- [ ] Angenommen ein Admin wird von einem Kurs entfernt, dann bleibt sein Konto und seine Rolle unverändert bestehen.

### Öffentliche Sichtbarkeit
- [ ] Angenommen ein Admin ist einem Kurs zugewiesen, wenn ein Besucher den Kurskatalog öffnet, dann steht sein Name auf der Kurskarte — genau wie bei einem regulären Lehrer.
- [ ] Angenommen ein Admin ist einem Kurs zugewiesen, wenn ein Besucher den Stundenplan oder die Kursdetailseite öffnet, dann erscheint sein Name auch dort.
- [ ] Angenommen ein Admin ist **keinem** Kurs zugewiesen, wenn ein Besucher irgendeine öffentliche Seite aufruft, dann taucht sein Name **nirgends** auf.
- [ ] Angenommen es existieren mehrere Admin-Konten (u.a. technische Konten aus der Entwicklung), wenn die öffentliche Lehrer-Liste geladen wird, dann enthält sie ausschließlich Personen mit tatsächlicher Kurszuweisung.

### Lehrer-Ansicht für unterrichtende Admins
- [ ] Angenommen ein Admin ist mindestens einem Kurs zugewiesen, wenn er eingeloggt ist, dann sieht er den Menüpunkt „Meine Kurse".
- [ ] Angenommen ein Admin ist keinem Kurs zugewiesen, wenn er eingeloggt ist, dann sieht er den Menüpunkt „Meine Kurse" **nicht**.
- [ ] Angenommen ein unterrichtender Admin öffnet „Meine Kurse", dann sieht er genau die Kurse, denen er zugewiesen ist — nicht alle Kurse der Schule.
- [ ] Angenommen ein unterrichtender Admin öffnet einen seiner Kurse, dann kann er Anwesenheiten und Notizen pflegen wie ein Lehrer.
- [ ] Angenommen ein Kunde ist eingeloggt, dann sieht er „Meine Kurse" weiterhin nicht.

### Bestehendes bleibt unberührt
- [ ] Angenommen ein regulärer Lehrer nutzt die App, wenn er sich einloggt, dann funktioniert für ihn alles unverändert.
- [ ] Angenommen ein Admin ist keinem Kurs zugewiesen, wenn er einen beliebigen Kurs über die Verwaltung öffnet, dann hat er weiterhin vollen Zugriff auf Anwesenheiten (bestehendes Admin-Recht, siehe PROJ-13).

## Edge Cases
- Was passiert mit der öffentlichen Lehrer-Liste, wenn ein zugewiesener Admin später von allen Kursen entfernt wird? → Sein Name verschwindet automatisch von den Kurskarten, weil die Liste sich aus den Zuweisungen ergibt.
- Was passiert, wenn ein Lehrer zum Admin gemacht wird (z.B. Lisa)? → Er behält seine Kurszuweisungen und bleibt auf den Kurskarten sichtbar. **Genau das ist der Hauptzweck dieses Features.**
- Was passiert, wenn ein zugewiesener Admin zurück zu `customer` gestuft wird? → Die Kurszuweisung bleibt bestehen; er verschwindet aber aus den Lehrer-Funktionen. Bewusst nicht automatisch aufgeräumt, damit keine Zuweisung stillschweigend verlorengeht.
- Sind die technischen Admin-Konten aus der Entwicklung ein Problem? → Nein: Sie sind keinem Kurs zugewiesen und tauchen deshalb öffentlich nicht auf.
- Was passiert mit den Anwesenheitsdaten, die am Lehrer-Zweitkonto des Betreibers hängen? → Sie bleiben unverändert bestehen. Dieses Feature legt keine Konten zusammen (siehe Out of Scope).

## Technical Requirements (optional)
- Security: Die öffentliche Lehrer-Liste ist bewusst auch für nicht eingeloggte Besucher lesbar. Sie darf **weiterhin nur Name und ID** enthalten und **nur** Personen mit tatsächlicher Kurszuweisung — Admin-Namen ohne Lehrtätigkeit dürfen dadurch nicht öffentlich werden.
- Die Zuweisung selbst bleibt Admins vorbehalten.

## Open Questions
- [ ] Nach Umsetzung: „Salsa On2 Footwork" vom Lehrer-Zweitkonto auf das Admin-Konto des Betreibers umhängen und das Zweitkonto stilllegen. Dabei ist zu klären, was mit den am Zweitkonto hängenden Anwesenheitsdaten und Notizen geschehen soll (übertragen vs. stehen lassen). Vom Nutzer so gewünscht, aber bewusst als eigener Schritt nach diesem Feature.
- [ ] Soll Lisa nach Umsetzung zum Admin gemacht werden? (Ursprünglicher Auslöser; vom Nutzer vorerst zurückgestellt.)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Kein allgemeines Mehrfachrollen-System, nur „Admin darf zusätzlich unterrichten" | Admins haben bereits alle Lehrer-Rechte; es fehlt lediglich Zuweisbarkeit und Sichtbarkeit. Ein echtes Rollen-System wäre ein Vielfaches an Aufwand ohne zusätzlichen Nutzen für eine Schule dieser Größe | 2026-08-22 |
| Öffentliche Lehrer-Liste ergibt sich aus der **Kurszuweisung**, nicht aus der Rolle | Löst das eigentliche Problem (Lisa verschwindet sonst von der Kurskarte) und verhindert zugleich, dass Admin-Namen ohne Lehrtätigkeit öffentlich werden — insbesondere die technischen Konten aus der Entwicklung | 2026-08-22 |
| „Meine Kurse" nur für Admins mit mindestens einer Zuweisung | Ein Admin, der nur verwaltet, hätte dort einen leeren Bereich; das Menü bleibt aufgeräumt | 2026-08-22 |
| Kurszuweisungen bleiben bei einer Rückstufung erhalten | Eine stillschweigend gelöschte Zuweisung wäre schwer nachvollziehbar; lieber sichtbar bestehen lassen | 2026-08-22 |
| Konto-Zusammenlegung ausdrücklich nicht Teil dieses Features | Betrifft Anwesenheiten, Notizen und Kurszuweisungen — das gehört bewusst entschieden, nicht nebenbei erledigt | 2026-08-22 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
