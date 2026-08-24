# PROJ-43: Englische Sprachvariante für den Kundenbereich

## Status: Planned
**Created:** 2026-08-24
**Last Updated:** 2026-08-24

## Dependencies
- Requires: PROJ-34 (Benachrichtigungs-Texte) — jede Vorlage braucht eine zweite Fassung.
- Requires: PROJ-42 (AGB-Zustimmung) — der Hinweis auf die maßgebliche Fassung sitzt an der Zustimmung.
- Berührt: PROJ-41 (Preise) — Beträge und Datumsangaben werden sprachabhängig formatiert.

## Ausgangslage
Das Studio hat einen erheblichen Anteil internationaler Kunden. Die App ist durchgehend
deutsch: rund **200 Textstellen** im Kundenbereich, dazu die Benachrichtigungen. Es ist
keine Übersetzungsbibliothek installiert, und am Kundenkonto wird keine Sprache gespeichert.

Der Kundenbereich umfasst: Startseite, Kurskatalog und Kursdetail, Stundenplan, Events,
Profil (Abos, Buchungen, Warteliste, Mandat, Benachrichtigungen), Rechnungsübersicht,
Login, Registrierung, Passwort-Zurücksetzen sowie die Rechtsseiten.

**Nicht Teil des Kundenbereichs:** `/admin` (Verwaltung), `/lehrer` (Lehreransicht) und
`/checkin` (Einlass) — alle drei sind Mitarbeiterbereiche und bleiben deutsch.

## User Stories
- Als internationaler Interessent möchte ich das Kursangebot in einer Sprache lesen können, die ich verstehe, bevor ich mich für ein Konto entscheide.
- Als internationaler Kunde möchte ich meine Buchungen, Abos und Rechnungen auf Englisch verwalten, ohne raten zu müssen, was ein Knopf tut.
- Als internationaler Kunde möchte ich Bestätigungen und Erinnerungen in meiner Sprache erhalten, nicht nur die Oberfläche.
- Als Kunde möchte ich die Sprache jederzeit umschalten können, auch wenn mein Browser etwas anderes meldet.
- Als Betreiber möchte ich, dass die deutschen Rechtstexte maßgeblich bleiben, ohne dass englische Kunden im Unklaren gelassen werden.
- Als Betreiber möchte ich meine Kurse und Events **nicht** doppelt pflegen müssen.

## Out of Scope
- **Weitere Sprachen** außer Deutsch und Englisch. Die Struktur soll eine dritte nicht verbauen, aber sie ist nicht Teil dieses Features.
- **Übersetzung der Verwaltung, der Lehreransicht und der Einlass-Seite.** Mitarbeiterbereiche bleiben deutsch.
- **Zweisprachige Datenbankinhalte** — Kursnamen, Tanzstile, Standorte, Raumnamen, Event-Namen und -Beschreibungen, Vorkenntnis-Hinweise. Sie erscheinen in beiden Sprachen so, wie sie eingetragen sind. Nachrüstbar, wenn es im Betrieb stört.
- **Übersetzung des Rechnungsbelegs.** Er ist ein Buchhaltungsdokument mit festem Aufbau und geht auch an den Steuerberater; nur die Übersicht drumherum wird zweisprachig.
- **Englische Fassung von AGB, Datenschutzerklärung und Impressum.** Siehe Product Decisions.
- **Automatische Maschinenübersetzung** zur Laufzeit. Die Texte werden einmal übersetzt und liegen im Projekt.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Sprachwahl
- [ ] Angenommen ein Besucher ohne Konto ruft die Seite mit englisch eingestelltem Browser auf, dann sieht er die englische Fassung.
- [ ] Angenommen ein Besucher ohne Konto ruft die Seite mit deutsch eingestelltem Browser auf, dann sieht er die deutsche Fassung.
- [ ] Angenommen ein Besucher schaltet die Sprache über den Umschalter um, dann bleibt seine Wahl auch beim nächsten Besuch bestehen und überstimmt die Browsersprache.
- [ ] Angenommen ein Kunde ist eingeloggt, dann gilt die an seinem Konto gespeicherte Sprache, unabhängig vom Browser.
- [ ] Angenommen ein eingeloggter Kunde schaltet die Sprache um, dann wird die neue Sprache an seinem Konto gespeichert.

### Adressen
- [ ] Angenommen die deutsche Fassung wird aufgerufen, dann bleiben die bisherigen Adressen unverändert (`/kurse`, `/profil`, …).
- [ ] Angenommen die englische Fassung wird aufgerufen, dann trägt die Adresse das Präfix `/en` (`/en/kurse`).
- [ ] Angenommen ein Kunde gibt einen englischen Link weiter, wenn der Empfänger ihn öffnet, dann sieht dieser dieselbe Sprache — auch ohne Konto.

### Oberfläche
- [ ] Angenommen ein Kunde nutzt die englische Fassung, dann sind alle Bedienelemente, Beschriftungen, Hinweise und Fehlermeldungen des Kundenbereichs auf Englisch.
- [ ] Angenommen ein Datum oder ein Betrag wird angezeigt, dann folgt die Schreibweise der gewählten Sprache; die Währung bleibt Euro.
- [ ] Angenommen ein Inhalt stammt aus der Datenbank (Kursname, Tanzstil, Standort), dann erscheint er unverändert, wie er eingetragen ist.
- [ ] Angenommen eine Übersetzung fehlt, dann erscheint der deutsche Text statt einer leeren Stelle oder eines technischen Platzhalters.

### Benachrichtigungen
- [ ] Angenommen ein Kunde hat Englisch gewählt, wenn eine E-Mail oder Push-Nachricht an ihn ausgelöst wird, dann kommt sie auf Englisch.
- [ ] Angenommen ein Kunde hat keine Sprache gewählt, dann bleibt es bei Deutsch.
- [ ] Angenommen der Betreiber passt eine Benachrichtigungs-Vorlage an, dann bearbeitet er beide Sprachfassungen getrennt und sieht, welche er gerade bearbeitet.
- [ ] Angenommen für eine Vorlage existiert keine englische Fassung, dann wird die deutsche verschickt statt gar keiner.

### Rechtstexte
- [ ] Angenommen ein Kunde nutzt die englische Fassung, wenn er die AGB öffnet, dann sieht er den deutschen Text mit einem englischen Hinweis darüber, dass die deutsche Fassung die verbindliche ist.
- [ ] Angenommen ein Kunde bucht in der englischen Fassung, dann ist die Zustimmung auf Englisch formuliert und verweist auf denselben deutschen Text.
- [ ] Angenommen der Betreiber sieht sich die Zustimmung in der Verwaltung an, dann ändert sich am festgehaltenen Nachweis nichts — es gibt weiterhin nur einen AGB-Stand.

## Edge Cases
- Was passiert bei einer Sprache, die weder Deutsch noch Englisch ist (z.B. Browser auf Spanisch)? → Englisch. Wer nicht Deutsch eingestellt hat, versteht es wahrscheinlich auch nicht.
- Was passiert mit den 52 Bestandskunden, die keine Sprache gespeichert haben? → Deutsch, wie bisher. Niemand wird ungefragt umgestellt.
- Was, wenn ein Kunde auf `/en/kurse` geht, aber an seinem Konto Deutsch gespeichert ist? → Die Adresse gewinnt für diesen Besuch; das Konto wird dabei **nicht** stillschweigend geändert. Wer dauerhaft umstellen will, nutzt den Umschalter.
- Was, wenn eine Übersetzung nachträglich fehlt, weil ein neuer Text nur deutsch ergänzt wurde? → Der deutsche Text erscheint. Eine leere Stelle oder ein Schlüssel wie `booking.submit` wäre schlimmer als eine Sprachmischung.
- Was passiert mit bereits verschickten Benachrichtigungen in der Warteschlange, wenn ein Kunde die Sprache wechselt? → Sie gehen in der Sprache raus, die beim Einstellen galt. Nachträglich umzuschreiben wäre mehr Aufwand als Nutzen.
- Was sieht ein Kunde auf `/en/rechnungen/123`? → Die Übersicht auf Englisch, den Beleg selbst auf Deutsch.

## Technical Requirements (optional)
- Die Struktur muss eine dritte Sprache erlauben, ohne dass jede Seite erneut angefasst werden muss.
- Bestehende Adressen dürfen nicht brechen: gespeicherte Lesezeichen und verschickte Links zeigen weiterhin auf gültige Seiten.
- Die Sprachwahl eines Gastes muss ohne Konto überdauern.

## Open Questions
- [ ] Gibt es für die Marketing-Website bereits englische Formulierungen (Kursbezeichnungen, Tonfall), an denen sich die Übersetzung ausrichten soll?
- [ ] Soll der Umschalter auch in der Verwaltung erscheinen, damit der Betreiber die englische Fassung prüfen kann, ohne den Browser umzustellen?
- [ ] Wie wird mit Bestandskunden umgegangen, von denen bekannt ist, dass sie kein Deutsch sprechen — einmalig anschreiben oder abwarten, bis sie selbst umschalten?

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Nur der Kundenbereich wird zweisprachig; Verwaltung, Lehreransicht und Einlass bleiben deutsch | Vom Betreiber so gewünscht. Mitarbeiterbereiche werden von deutschsprachigem Personal bedient; sie mit zu übersetzen wäre Aufwand ohne Nutzen | 2026-08-24 |
| Die Sprache wird am Kundenkonto gespeichert | Benachrichtigungen gehen raus, wenn niemand vor dem Bildschirm sitzt. Ohne gespeicherte Sprache bekäme ein englischer Kunde deutsche Mails — genau der Bruch, den das Feature vermeiden soll | 2026-08-24 |
| Deutsche Rechtstexte bleiben maßgeblich, mit englischem Hinweis | Eine Übersetzung wäre ein zweites Rechtsdokument, das auseinanderlaufen kann, und müsste juristisch verantwortet werden. Der Hinweis ist ehrlicher als eine unverbindliche Übersetzung | 2026-08-24 |
| Browsersprache beim ersten Besuch, Umschalter überstimmt sie | Ein internationaler Interessent soll nicht erst suchen müssen. Wer die Automatik nicht mag, schaltet einmal um und wird nicht wieder gefragt | 2026-08-24 |
| Englisch für alle Nicht-Deutsch-Browser | Zwei Sprachen, zwei Fälle. Wer den Browser auf Spanisch stehen hat, kommt mit Englisch weiter als mit Deutsch | 2026-08-24 |
| Sprache in der Adresse, Deutsch ohne Präfix | Ein weitergegebener Link zeigt beim Empfänger dieselbe Sprache. Deutsch behält seine bisherigen Adressen, damit keine Lesezeichen und keine verschickten Links brechen | 2026-08-24 |
| Datenbankinhalte bleiben vorerst einsprachig | Kursnamen wie „Salsa Beginner 1" und Tanzstile funktionieren international ohnehin, Standorte sind Eigennamen. Zweisprachige Felder hießen: jedes neue Event doppelt tippen | 2026-08-24 |
| Der Rechnungsbeleg bleibt deutsch | Ein Buchhaltungsdokument mit festem Aufbau, das auch zum Steuerberater geht. Belege in zwei Formen machen die Buchhaltung unübersichtlich | 2026-08-24 |
| Fehlende Übersetzung fällt auf Deutsch zurück | Eine Sprachmischung ist unschön, eine leere Stelle oder ein sichtbarer Platzhalter ist ein Fehler | 2026-08-24 |
| Bestandskunden bleiben bei Deutsch | 52 Kunden nutzen die App heute auf Deutsch. Sie ungefragt umzustellen wäre eine Änderung, um die niemand gebeten hat | 2026-08-24 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|

---

## Tech Design (Solution Architect)
_To be added by /architecture_

---

## Implementation Notes
_To be added by /frontend and /backend_

---

## QA Test Results
_To be added by /qa_

---

## Deployment
_To be added by /deploy_
