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
| Öffentliche Sichtbarkeit hängt an der Kurszuweisung, nicht an der Rolle | Die Rolle ist eine interne Berechtigung, die Kurskarte eine öffentliche Aussage. Beides zu koppeln ist genau der Grund, warum eine Beförderung heute jemanden von der Kursseite löschen würde | 2026-08-23 |
| Kein neues Datenfeld, keine zweite Rolle | Die Zuweisung Kurs ↔ Person existiert bereits und wird genutzt. Ein Mehrfachrollen-System wäre ungleich aufwendiger und löst kein vorhandenes Problem | 2026-08-23 |
| Technische Admin-Konten brauchen keine Ausnahmeliste | Sie unterrichten keinen Kurs und fallen dadurch von selbst aus der öffentlichen Liste. Eine gepflegte Ausschlussliste würde irgendwann veralten | 2026-08-23 |
| Ein Lehrer ohne Kurs erscheint nicht mehr in der öffentlichen Liste | Sein Name stand ohnehin auf keiner Kurskarte; die Liste dient nur dazu, Namen zu Kursen aufzulösen | 2026-08-23 |
| „Meine Kurse" nur bei tatsächlicher Zuweisung | Ein Menüpunkt, der auf eine leere Seite führt, ist kein Angebot. Der Vollzugriff auf Anwesenheiten über die Verwaltung bleibt davon unberührt | 2026-08-23 |
| Kunden bleiben aus der Lehrer-Auswahl ausgeschlossen | Für Kunden gibt es weiterhin den Rollenwechsel aus PROJ-22; die Auswahl bleibt auf Lehrer und Admins begrenzt | 2026-08-23 |

---

## Tech Design (Solution Architect)

### A) Component Structure (Visual Tree)

```
Verwaltung → Kurse → Kurs bearbeiten
└── Lehrer-Auswahl
       vorher: nur Personen mit Rolle „Lehrer"
       NEU:    Lehrer UND Admins

Öffentliche Seiten (Kurskatalog, Stundenplan, Kursdetail)
└── Lehrer-Name auf der Kurskarte
       vorher: nur Personen mit Rolle „Lehrer"
       NEU:    jede Person, die dem Kurs tatsächlich zugewiesen ist

Globale Navigation
└── Menüpunkt „Meine Kurse"
       vorher: nur bei Rolle „Lehrer"
       NEU:    auch für Admins, die mindestens einen Kurs unterrichten
```

Es entsteht **kein neuer Bildschirm**. Drei bestehende Stellen ändern ihre Frage.

### B) Data Model (plain language)

**Es wird nichts Neues gespeichert.** Keine neue Tabelle, keine neue Spalte, keine zweite Rolle.

```
Bisher lautete die Frage überall:  "Welche Rolle hat diese Person?"
Künftig lautet sie:                "Unterrichtet diese Person diesen Kurs?"

Die Zuweisung Kurs ↔ Person existiert bereits (course_teachers) und wird
heute schon genutzt. Sie wird nur an drei Stellen zur maßgeblichen Quelle.
```

**Die Rolle bleibt unangetastet.** Ein Admin, der einem Kurs zugewiesen wird, bleibt Admin und
behält alle Verwaltungsrechte. Wird er wieder entfernt, ändert sich an seinem Konto nichts.

### C) Tech Decisions (justified for PM)

- **Die Zuweisung entscheidet, nicht die Rolle.** Das ist die eigentliche Idee dieses Features. Wer
  öffentlich als Lehrer erscheint, ist heute an der internen Rolle festgemacht — deshalb würde eine
  Beförderung zur Mitinhaberin jemanden von den Kurskarten löschen. Künftig zählt, was tatsächlich
  zutrifft: Unterrichtest du diesen Kurs?

- **Damit löst sich ein Problem, das dieses Feature gar nicht adressieren sollte:** Es gibt mehrere
  technische Admin-Konten aus der Entwicklung. Nach der Umstellung tauchen sie öffentlich nirgends
  auf — nicht weil sie ausgefiltert werden, sondern weil sie schlicht keinen Kurs unterrichten. Die
  Regel braucht keine Ausnahmeliste, die jemand pflegen müsste.

- **Ein Lehrer ohne Kurs verschwindet aus der öffentlichen Liste.** Das klingt nach Nebenwirkung,
  ist aber richtig: Sein Name stand ohnehin auf keiner Kurskarte, weil er keinem Kurs zugeordnet ist.
  Die Liste dient ausschließlich dazu, Namen zu Kursen aufzulösen.

- **„Meine Kurse" erscheint nur bei tatsächlicher Zuweisung.** Ein Admin, der nicht unterrichtet,
  bekommt keinen Menüpunkt, der ihm eine leere Seite zeigt. Er behält davon unabhängig vollen
  Zugriff auf alle Anwesenheiten über die Verwaltung — das ist ein bestehendes Admin-Recht und
  wird nicht angetastet.

- **Kein allgemeines Mehrfachrollen-Konzept.** Es geht ausschließlich darum, dass ein Admin
  zusätzlich unterrichten kann. Admins haben ohnehin bereits Zugriff auf sämtliche
  Lehrer-Funktionen — es fehlt nur die Zuweisbarkeit und die Sichtbarkeit. Ein frei kombinierbares
  Rollensystem wäre ungleich aufwendiger und löst kein Problem, das du hast.

- **Kunden bleiben außen vor.** In der Lehrer-Auswahl stehen weiterhin nur Lehrer und Admins. Wer
  einen Kunden unterrichten lassen will, befördert ihn wie bisher über die Lehrer-Verwaltung.

### D) Dependencies (packages to install)

Keine. Es ändern sich drei bestehende Abfragen.

### Umfang

Betroffen sind drei Stellen: die öffentliche Lehrer-Liste, die Auswahl im Kursformular und die
Bedingung für den Menüpunkt „Meine Kurse". Kein neuer Bildschirm, keine neue Tabelle, keine neue
Abhängigkeit.

---

## Implementation Notes (Frontend)

**Umgesetzt am 2026-08-23.** Vier Stellen statt der im Entwurf angenommenen drei — `requireTeacher`
lehnte Admins bislang ausdrücklich ab und musste ebenfalls angepasst werden.

### Geänderte/neue Dateien
| Datei | Zweck |
|-------|-------|
| `supabase/migrations/…_proj40_teacher_directory_by_assignment.sql` | Öffentliche Liste folgt der Zuweisung statt der Rolle |
| `src/app/admin/kurse/page.tsx` | Lehrer-Auswahl enthält Lehrer **und** Admins |
| `src/lib/auth/teaches-courses.ts` (neu) | Gemeinsame Antwort auf „unterrichtet diese Person?" |
| `src/app/(site)/layout.tsx` | Menüpunkt „Meine Kurse" für unterrichtende Admins |
| `src/lib/auth/require-teacher.ts` | Zugriff auf `/lehrer` für zugewiesene Admins |

### Entscheidungen bei der Umsetzung
- **Die Bedingung liegt an einer Stelle** (`isTeachingUser`). Navigation und Zugriffsschutz stellen
  dieselbe Frage; zwei Kopien wären irgendwann auseinandergelaufen und hätten einen Menüpunkt
  gezeigt, der ins Leere führt.
- **Ein Lehrer gilt immer als unterrichtend, auch ohne Kurs.** Ein frisch angelegter Lehrer soll
  „Meine Kurse" vorfinden, statt erst auf eine Zuweisung warten zu müssen. Für Admins gilt das
  bewusst nicht — ihnen einen Menüpunkt auf eine leere Seite zu geben, wäre kein Angebot.
- **Die Rollenprüfung bleibt in der öffentlichen Liste erhalten**, obwohl die Zuweisung allein
  ausreichen würde. Falls je eine versehentliche Zuweisung auf ein Kundenkonto zeigt, wird dessen
  Name dadurch nicht öffentlich.

### Verifiziert (Admin-Konto testweise einem Kurs zugewiesen)
| Prüfung | ohne Zuweisung | mit Zuweisung |
|---------|----------------|---------------|
| Menüpunkt „Meine Kurse" | nein | **ja** |
| `/lehrer` erreichbar | nein (Weiterleitung) | **ja** |
| Sieht seinen Kurs | — | **ja** |
| Öffentlich sichtbar | nein | **ja** |
| Rolle nach der Zuweisung | — | **unverändert `admin`** |

Lehrer-Auswahl im Kursformular: 23 Personen, davon 11 Admins — Admins sind also wählbar.

### Beobachtung für die QA
Die Lehrer-Auswahl zeigt jetzt **alle** Admin-Konten, einschließlich der elf technischen Konten aus
der Entwicklung. Das ist kein Fehler dieses Features, sondern vorhandene Datenhygiene, die hier
erstmals sichtbar wird. Die Auswahl hat ein Suchfeld; ob die Altkonten aufgeräumt werden sollten,
ist eine eigene Entscheidung.

### Backend
Kein separater Backend-Schritt nötig: Es ändern sich ausschließlich Abfragen und eine
Datenbank-Sicht. Es gibt keine neuen Aktionen, keine neue Tabelle und keine neue Route.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
