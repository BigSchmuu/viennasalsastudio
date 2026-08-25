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
- **Englische Fassung von Datenschutzerklärung und Impressum.** Beide bleiben deutsch; die englische Oberfläche verlinkt sie mit einem Hinweis.
- **Ein eigenständiges englisches Rechtsdokument.** Die AGB bekommen eine Übersetzung als Lesehilfe, keine zweite verbindliche Fassung — siehe Product Decisions.
- **Ein zweiter AGB-Stand für die englische Fassung.** Es bleibt bei einem Stand; die Zustimmung aus PROJ-42 ändert sich nicht.
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
- [ ] Angenommen ein Kunde nutzt die englische Fassung, wenn er die AGB öffnet, dann liest er sie auf Englisch.
- [ ] Angenommen er liest die englischen AGB, dann steht darüber ein Hinweis, dass es sich um eine Übersetzung handelt und die deutsche Fassung die verbindliche ist — mit einem Link dorthin.
- [ ] Angenommen ein Kunde nutzt die englische Fassung, wenn er Datenschutzerklärung oder Impressum öffnet, dann sieht er den deutschen Text mit einem englischen Hinweis darüber.
- [ ] Angenommen ein Kunde bucht in der englischen Fassung, dann ist die Zustimmung auf Englisch formuliert und verlinkt die englischen AGB.
- [ ] Angenommen ein Kunde stimmt zu — gleich in welcher Sprache —, dann wird derselbe eine AGB-Stand festgehalten.
- [ ] Angenommen die deutschen AGB werden inhaltlich geändert, dann ist erkennbar, dass die Übersetzung nachgezogen werden muss.

## Edge Cases
- Was passiert bei einer Sprache, die weder Deutsch noch Englisch ist (z.B. Browser auf Spanisch)? → Englisch. Wer nicht Deutsch eingestellt hat, versteht es wahrscheinlich auch nicht.
- Was passiert mit den 52 Bestandskunden, die keine Sprache gespeichert haben? → Deutsch, wie bisher. Niemand wird ungefragt umgestellt.
- Was, wenn ein Kunde auf `/en/kurse` geht, aber an seinem Konto Deutsch gespeichert ist? → Die Adresse gewinnt für diesen Besuch; das Konto wird dabei **nicht** stillschweigend geändert. Wer dauerhaft umstellen will, nutzt den Umschalter.
- Und umgekehrt: Was zeigt `/kurse` einem Kunden, der Englisch gewählt hat? → Englisch. Die Adresse ohne Präfix nennt keine Sprache, also gilt die Wahl des Lesers. Nur eine Adresse **mit** `/en` ist eine ausdrückliche Ansage und schlägt die Wahl. Wer nie umgeschaltet hat, sieht weiterhin Deutsch.
- Was, wenn eine Übersetzung nachträglich fehlt, weil ein neuer Text nur deutsch ergänzt wurde? → Der deutsche Text erscheint. Eine leere Stelle oder ein Schlüssel wie `booking.submit` wäre schlimmer als eine Sprachmischung.
- Was passiert mit bereits verschickten Benachrichtigungen in der Warteschlange, wenn ein Kunde die Sprache wechselt? → Sie gehen in der Sprache raus, die beim Einstellen galt. Nachträglich umzuschreiben wäre mehr Aufwand als Nutzen.
- Was sieht ein Kunde auf `/en/rechnungen/123`? → Die Übersicht auf Englisch, den Beleg selbst auf Deutsch.
- Was, wenn die deutschen AGB geändert werden und die Übersetzung noch fehlt? → Dann erscheint der deutsche Text mit dem Hinweis, bis die Übersetzung nachgezogen ist. Eine veraltete Übersetzung stehen zu lassen wäre schlimmer: ein falscher Rechtstext in der Sprache des Lesers.

## Technical Requirements (optional)
- Die Struktur muss eine dritte Sprache erlauben, ohne dass jede Seite erneut angefasst werden muss.
- Bestehende Adressen dürfen nicht brechen: gespeicherte Lesezeichen und verschickte Links zeigen weiterhin auf gültige Seiten.
- Die Sprachwahl eines Gastes muss ohne Konto überdauern.

## Open Questions
- [x] Sollen die drei Rechtsseiten unter `/en` erreichbar sein? → Ja, alle drei. Die AGB in englischer Übersetzung, Datenschutz und Impressum als deutscher Text mit englischem Hinweis darüber (2026-08-24)
- [ ] Wer verantwortet die Übersetzung der AGB fachlich? Sie wird als Lesehilfe erstellt, nicht als Rechtstext — ob das dem Betreiber genügt, ist seine Entscheidung. (2026-08-24)
- [x] BUG-1: Der Sprachumschalter gehört auch ins Mobilmenü. → Behoben; er steht dort jetzt abgetrennt unter den Menüpunkten (2026-08-25)
- [ ] Gibt es für die Marketing-Website bereits englische Formulierungen (Kursbezeichnungen, Tonfall), an denen sich die Übersetzung ausrichten soll?
- [ ] Soll der Umschalter auch in der Verwaltung erscheinen, damit der Betreiber die englische Fassung prüfen kann, ohne den Browser umzustellen?
- [ ] Wie wird mit Bestandskunden umgegangen, von denen bekannt ist, dass sie kein Deutsch sprechen — einmalig anschreiben oder abwarten, bis sie selbst umschalten?

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Nur der Kundenbereich wird zweisprachig; Verwaltung, Lehreransicht und Einlass bleiben deutsch | Vom Betreiber so gewünscht. Mitarbeiterbereiche werden von deutschsprachigem Personal bedient; sie mit zu übersetzen wäre Aufwand ohne Nutzen | 2026-08-24 |
| Die Sprache wird am Kundenkonto gespeichert | Benachrichtigungen gehen raus, wenn niemand vor dem Bildschirm sitzt. Ohne gespeicherte Sprache bekäme ein englischer Kunde deutsche Mails — genau der Bruch, den das Feature vermeiden soll | 2026-08-24 |
| Die AGB bekommen eine englische Übersetzung als Lesehilfe; die deutsche Fassung bleibt verbindlich | Vom Betreiber gewünscht (Korrektur der ursprünglichen Entscheidung). Ein internationaler Kunde soll lesen können, wozu er beim Buchen Ja sagt. Ein *eigenständiges* englisches Rechtsdokument wäre etwas anderes: zwei gültige Fassungen, im Zweifel gegeneinander auslegbar, und juristisch zu verantworten | 2026-08-24 |
| Datenschutzerklärung und Impressum bleiben deutsch, mit Hinweis | Vom Betreiber so entschieden. Sie werden selten gelesen und selten geändert; eine Übersetzung wäre Pflegeaufwand ohne erkennbaren Nutzen | 2026-08-24 |
| Es bleibt bei einem AGB-Stand, unabhängig von der gelesenen Sprache | Zwei Stände hießen zwei Nachweise, die auseinanderlaufen können — und der Nachweis aus PROJ-42 ist der Grund, warum es ihn gibt | 2026-08-24 |
| Fehlt die Übersetzung zu einem geänderten deutschen Text, erscheint der deutsche mit Hinweis | Eine veraltete Übersetzung ist ein falscher Rechtstext in der Sprache des Lesers — schlimmer als ein aktueller in einer Fremdsprache | 2026-08-24 |
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
| `AGB_TRANSLATION_VERSION` neben `AGB_VERSION`: weicht sie ab, erscheint der deutsche Text | Erzwingt, dass die Übersetzung beim Ändern der AGB nachgezogen wird. Eine veraltete Übersetzung ist ein falscher Rechtstext in der Sprache des Lesers | 2026-08-25 |
| Der Umschalter navigiert hart statt weich | Sonst behält die Seite `lang="de"`, während sie englisch dasteht — Screenreader und Browser-Übersetzung lägen falsch | 2026-08-25 |
| Monatsnamen aus der Laufzeitumgebung statt aus dem Katalog | Zwölf Einträge, die niemand je ändert, in zwei Sprachen zu pflegen wäre Arbeit ohne Nutzen | 2026-08-25 |
| next-intl statt Eigenbau | Adressen, Serverseiten, Formate und Rückfallregeln sind mehr Arbeit, als es aussieht; die Bibliothek unterstützt die eingesetzte Next.js-Version und Deutsch ohne Präfix | 2026-08-24 |
| Übersetzungen liegen in Dateien, nicht in der Datenbank | Sie ändern sich mit dem Code. In der Datenbank wären sie eine weitere Pflegestelle und eine zusätzliche Abfrage je Seitenaufruf | 2026-08-24 |
| Lehreransicht und Einlass werden aus dem Kundenbereich herausgelöst | Sonst wären sie als /en/lehrer erreichbar und würden dort deutschen Text zeigen. Die Adressen bleiben unverändert | 2026-08-24 |
| Die Vorlagen-Anpassungen werden je Vorlage **und** Sprache abgelegt | Sonst könnte der Betreiber nur eine der beiden Fassungen anpassen. Aktuell null angepasste Vorlagen, die Umstellung kostet also nichts | 2026-08-24 |
| Die Empfängersprache wird beim Versand aus dem Profil gelesen, nicht aus einem Sitzungszustand | Der Versand läuft im Hintergrund; eine „aktuelle Sprache" gibt es dort nicht | 2026-08-24 |
| Zahlen und Daten sprachabhängig, Währung fest in Euro | Das Studio rechnet in Euro, unabhängig davon, wer liest | 2026-08-24 |

---

## Tech Design (Solution Architect)

### A) Component Structure (Visual Tree)

```
Adressen — Deutsch bleibt wie es ist, Englisch bekommt ein Präfix
├── /kurse            /profil        /events        …   (Deutsch, unverändert)
└── /en/kurse         /en/profil     /en/events     …   (Englisch)

Kundenbereich (wandert unter die Sprachebene)
├── Startseite · Kurse · Kursdetail · Stundenplan · Events
├── Profil (Abos, Buchungen, Warteliste, Mandat, Benachrichtigungen)
├── Rechnungsübersicht  ─ Beleg selbst bleibt deutsch
├── Login · Registrierung · Passwort vergessen/zurücksetzen
├── AGB → englische Übersetzung, darüber der Hinweis:
│          Übersetzung, die deutsche Fassung ist verbindlich (mit Link)
└── Datenschutz · Impressum → deutscher Text, englischer Hinweis darüber

Mitarbeiterbereich (bleibt außerhalb der Sprachebene, bleibt deutsch)
├── Verwaltung  /admin/…
├── Lehreransicht  /lehrer/…      ← muss aus dem Kundenbereich herausgelöst werden
└── Einlass  /checkin             ← ebenfalls

Kopfzeile (bestehend)
└── NEU: Sprachumschalter  DE | EN
       Gast: Wahl bleibt im Browser gespeichert
       Eingeloggt: Wahl wird ans Konto geschrieben

Verwaltung → Benachrichtigungs-Texte (bestehend, PROJ-34)
└── NEU: Umschalter Deutsch / Englisch über der Vorlage
       sichtbar, welche Fassung gerade bearbeitet wird
```

**Ein Umbau, der vorher passieren muss:** Lehreransicht und Einlass liegen heute im selben
Bereich wie die Kundenseiten. Bliebe das so, wären sie als `/en/lehrer` erreichbar und
würden dort deutschen Text zeigen. Sie werden vorher herausgelöst — für den Benutzer ändert
sich dabei nichts, die Adressen bleiben gleich.

### B) Data Model (plain language)

```
Am Kundenkonto kommt hinzu:
- Sprache        "de" oder "en", leer erlaubt (= Deutsch, wie bisher)

Bei den Benachrichtigungs-Vorlagen:
- bisher: eine angepasste Fassung je Vorlage
- künftig: eine angepasste Fassung je Vorlage UND Sprache

Die Oberflächentexte liegen nicht in der Datenbank, sondern in zwei Dateien
im Projekt — eine deutsche, eine englische, mit denselben Einträgen.
```

**Gast ohne Konto:** die Sprachwahl bleibt im Browser gespeichert und überdauert den Besuch.
Ein Konto ist dafür nicht nötig — sonst sähe genau die Gruppe, die gewonnen werden soll, die
falsche Sprache.

### C) Tech Decisions (justified for PM)

- **Eine etablierte Übersetzungsbibliothek statt Eigenbau.** Sprachumschaltung sieht
  einfach aus und ist es nicht: Adressen, Serverseiten, Zahlen- und Datumsformate,
  Rückfallregeln. Das selbst zu bauen hieße, dieselben Fehler noch einmal zu machen, die
  andere schon behoben haben.

- **Deutsch behält seine Adressen, Englisch bekommt `/en`.** Jedes gespeicherte Lesezeichen
  und jeder bereits verschickte Link zeigt weiterhin auf eine gültige Seite. Ein Präfix
  auch für Deutsch wäre sauberer im Schema — und würde am ersten Tag alle bestehenden Links
  brechen.

- **Die Sprache steht am Konto, nicht nur im Browser.** Eine E-Mail entsteht, wenn niemand
  vor dem Bildschirm sitzt — beim nächtlichen Versand, beim Bestätigen durch den Betreiber.
  In dem Moment gibt es keine „gerade eingestellte Sprache". Nur was am Empfänger steht, ist
  dann noch da.

- **Texte in Dateien, nicht in der Datenbank.** Sie ändern sich mit dem Code und gehören zu
  ihm. In der Datenbank wären sie ohne Not eine weitere Stelle zum Pflegen — und bei jedem
  Seitenaufruf eine zusätzliche Abfrage.

- **Fehlt eine Übersetzung, erscheint der deutsche Text.** Eine Sprachmischung ist unschön;
  eine leere Stelle oder ein sichtbarer Platzhalter wäre ein Fehler, den der Kunde sieht.

- **Zahlen und Datumsangaben folgen der Sprache, die Währung nicht.** „So., 06.09." wird zu
  „Sun, 6 Sep", „€ 65,00" zu „€65.00". Der Betrag bleibt in Euro — das Studio rechnet
  in Euro, unabhängig davon, wer liest.

- **Die Verwaltung bleibt deutsch und außerhalb.** Sie wird von deutschsprachigem Personal
  bedient. Sie mitzuübersetzen hieße, den Aufwand ungefähr zu verdoppeln, ohne dass jemand
  etwas davon hat.

### D) Dependencies (packages to install)

- **next-intl** — Übersetzungen, Sprache in der Adresse, sprachabhängige Zahlen- und
  Datumsformate. Unterstützt die eingesetzte Next.js-Version und die Variante
  „Standardsprache ohne Präfix".

Sonst keine.

### Umfang

Neu: zwei Übersetzungsdateien, ein Sprachumschalter, eine Spalte am Kundenkonto, eine
zweite Fassung der vierzehn Benachrichtigungs-Vorlagen, ein Sprachwahl-Schalter im
Vorlagen-Editor.

Angefasst: **jede Seite und jede Komponente des Kundenbereichs** — rund 200 Textstellen.
Breit, aber flach: pro Stelle wird ein fester Text durch einen Verweis ersetzt.

Verschoben: Lehreransicht und Einlass aus dem Kundenbereich heraus, ohne dass sich ihre
Adressen ändern.

### Was dieser Entwurf nicht löst

Inhalte aus der Datenbank — Kursnamen, Tanzstile, Standorte, Event-Beschreibungen —
erscheinen weiter so, wie sie eingetragen sind. Das ist eine bewusste Grenze, keine
Auslassung: sie zweisprachig zu machen hieße, jedes neue Event doppelt zu tippen.


---

## Implementation Notes
_To be added by /frontend and /backend_

---

## Implementation Notes (Frontend/Backend)

**Stand:** umgesetzt am 2026-08-25, in sieben Etappen.

### Unterbau
- `next-intl` mit `localePrefix: "as-needed"` — Deutsch behält jede bisherige Adresse,
  nur Englisch bekommt `/en`. Kein Lesezeichen und kein verschickter Link bricht.
- Lehreransicht und Einlass sind aus dem Kundenbereich herausgelöst (`(staff)`), damit sie
  nicht als `/en/lehrer` mit deutschem Text erreichbar sind. Ihre Adressen bleiben gleich.
- Die Middleware macht zweierlei, und die Reihenfolge ist nicht beliebig: Die Sprachweiche
  entscheidet zuerst, weil sie umleiten kann; kommt sie ohne Umleitung zurück, schreibt die
  Sitzungsauffrischung ihre Cookies auf **deren** Antwort. Umgekehrt ginge eines von beidem
  verloren.
- `/profil` ist geschützt, `/en/profil` genauso — und die Umleitung behält die Sprache.

### Sprache
- Spalte `profiles.language` (`de`/`en`, leer = Deutsch wie bisher).
- Gäste: Sprach-Cookie, ein Jahr gültig.
- Umschalter in der Kopfzeile, nur im Kundenbereich.

### Texte
Rund 200 Stellen in zwei Katalogdateien. Fehlt eine Übersetzung, erscheint der deutsche
Text — eine leere Stelle oder ein sichtbarer Schlüssel wäre ein Fehler, den der Kunde sieht.

Zahlen und Datumsangaben folgen der Sprache, die Währung nicht: „€ 60,00" gegen
„€60.00". Für Englisch `en-IE` statt `en-US` — irisches Englisch schreibt den Tag vor den
Monat und rechnet in Euro.

### Benachrichtigungen
Alle vierzehn Vorlagen haben eine englische Fassung. Welche gilt, entscheidet
`profiles.language` — **nicht** die Browsersprache: Eine Benachrichtigung entsteht im
Hintergrund, wenn niemand vor dem Bildschirm sitzt.

Angepasste Vorlagen liegen je Vorlage **und** Sprache; der Editor bekommt eine Sprachwahl,
die in der Adresse steht, damit sie das Speichern übersteht.

### Rechtstexte
Die AGB gibt es auf Englisch, mit Hinweis darüber. Datenschutz und Impressum bleiben
deutsch, ebenfalls mit Hinweis.

**Eine Sicherung gegen veraltete Übersetzungen:** `AGB_TRANSLATION_VERSION` in
`src/lib/legal.ts` hält fest, welchen Stand die Übersetzung wiedergibt. Weicht sie von
`AGB_VERSION` ab, zeigt die englische Seite den **deutschen** Text — eine veraltete
Übersetzung wäre ein falscher Rechtstext in der Sprache des Lesers.

### Befunde beim Bauen
- **Feste Links verloren das Präfix.** Zwei `<a href="/impressum">` in AGB und Datenschutz
  hätten einen englischen Leser auf die deutsche Seite geworfen; der Linter deckte sie auf,
  sobald die Sprachebene stand.
- **`<html lang>` blieb nach dem Umschalten stehen.** Der äußerste Rahmen wird bei einer
  weichen Navigation nicht neu gerendert — Screenreader und die Browser-Übersetzung hätten
  die falsche Sprache angenommen. Der Umschalter macht jetzt einen echten Seitenwechsel.
- **Der Link „Read the German version" brauchte ein ausdrückliches `locale`.** Eine Adresse
  ohne Präfix folgt der Sprachwahl des Lesers, ein englischer Kunde wäre also wieder auf der
  englischen Seite gelandet.
- **Ein Textfragment blieb stehen** („deaktiviert werden."), weil ich beim Ersetzen eines
  zweizeiligen Hinweises nur die erste Zeile getroffen hatte. Erst im Sichttest aufgefallen —
  der Typcheck kann so etwas nicht sehen.

### Ein Befund, der die ganze Testsuite betraf
Nach dem Umbau fielen **27 von 34** bestehenden Tests aus — nicht wegen des Produkts:
Playwrights Browser meldet standardmäßig `en-US`, also griff die Spracherkennung, jeder
Test landete auf `/en` und suchte vergeblich nach „E-Mail" statt „Email".

Genau das Verhalten, das gewünscht ist — nur eben auch im Testbrowser. In
`playwright.config.ts` steht jetzt `locale: 'de-DE'`: Die bestehenden Suiten prüfen die
deutsche Fassung, also treten sie als deutschsprachige Besucher auf. Die Tests zur
englischen Fassung überschreiben den Wert je Test.

**Nebenbei nachgewiesen:** Ein Besucher mit englisch eingestelltem Browser sieht die App
sofort auf Englisch, ohne etwas zu tun.

### Migrationen
| Datei | Inhalt |
|---|---|
| `20260825102802_proj43_customer_language.sql` | Spalte `profiles.language` |
| `20260825123919_proj43_template_overrides_per_language.sql` | Vorlagen-Anpassungen je Sprache |

---

## QA Test Results

**Getestet am:** 2026-08-25 · **Umgebung:** lokal gegen die Produktionsdatenbank (kein Staging)

### Akzeptanzkriterien: 18 von 18 erfüllt

| Bereich | Kriterium | Ergebnis |
|---|---|---|
| Sprachwahl | Englischer Browser sieht die englische Fassung | ✅ |
| Sprachwahl | Deutscher Browser sieht die deutsche Fassung | ✅ |
| Sprachwahl | Umschalter überdauert den Besuch und schlägt die Browsersprache | ✅ |
| Sprachwahl | Eingeloggter Kunde: es gilt die Sprache am Konto | ✅ |
| Sprachwahl | Umschalten schreibt die Wahl ans Konto | ✅ |
| Adressen | Deutsche Adressen unverändert | ✅ |
| Adressen | Englische Fassung unter `/en` | ✅ |
| Adressen | Weitergegebener englischer Link zeigt dieselbe Sprache | ✅ |
| Oberfläche | Kundenbereich durchgehend englisch | ✅ |
| Oberfläche | Beträge und Daten folgen der Sprache, Währung bleibt Euro | ✅ |
| Oberfläche | Datenbankinhalte erscheinen unverändert | ✅ |
| Oberfläche | Fehlende Übersetzung fällt auf Deutsch zurück | ✅ |
| Benachrichtigungen | In der Sprache des Kontos | ✅ |
| Benachrichtigungen | Ohne Wahl bleibt es bei Deutsch | ✅ |
| Benachrichtigungen | Betreiber pflegt beide Fassungen getrennt | ✅ |
| Benachrichtigungen | Fehlende englische Fassung → deutsche wird verschickt | ✅ |
| Rechtstexte | AGB auf Englisch mit Hinweis; Datenschutz/Impressum deutsch mit Hinweis | ✅ |
| Rechtstexte | Ein AGB-Stand, unabhängig von der gelesenen Sprache | ✅ |
| Sprachwahl | Umschalter erreichbar — auch auf dem Handy | ✅ (nach Behebung von BUG-1) |

### Gefundener Fehler

**BUG-1 — Der Sprachumschalter fehlt auf dem Handy (High)**

Der Umschalter sitzt in der Desktop-Navigation (`hidden md:flex`) und wurde nicht ins
Mobilmenü übernommen. Unter 768 px Breite ist er **gar nicht erreichbar**.

*Folge:* Wer auf dem Handy die Sprache wechseln will, kann es nicht — weder ein deutscher
Besucher, der lieber Englisch läse, noch ein Kunde, dessen Konto auf die andere Sprache
steht. Der einzige Ausweg wäre, die Browsersprache umzustellen.

*Warum High und nicht Medium:* Die automatische Erkennung deckt den Normalfall ab, aber
der Umschalter ist ein eigenes Akzeptanzkriterium, und für eine Tanzschule dürfte das Handy
der häufigste Zugang sein. Ein Kriterium, das für die Mehrheit der Besucher unerreichbar
ist, gilt nicht als erfüllt.

*Reproduzierbar:* Fenster auf 375 px, beliebige Kundenseite öffnen, Menü aufklappen — kein
DE/EN. Bei 768 px und darüber ist er da.

### Sicherheitsprüfung (Red Team)

| Angriff | Ergebnis |
|---|---|
| Sprache eines **fremden** Kontos setzen | ✅ abgewehrt (0 Zeilen) |
| Unsinnige Sprache am eigenen Konto (`../../etc/passwd`) | ✅ abgewehrt (CHECK) |
| Leerer String als Sprache | ✅ abgewehrt (CHECK) |
| Erfundene Sprache in der Adresse (`/xx`, `/de-DE`, `/en-US`) | ✅ 404 |
| Pfad-Ausbruch über die Sprache (`/..%2f..%2fetc`) | ✅ 404 |
| Manipuliertes Sprach-Cookie (`xx`, `../de`, `<script>`) | ✅ fällt auf Deutsch zurück, kein Einschleusen ins `lang`-Attribut |
| `/en/lehrer`, `/en/checkin`, `/en/admin` | ✅ 404 — Mitarbeiterbereiche haben keine Sprachebene |

Die eigene Sprache zu setzen ist erlaubt, wie es sein soll. `/EN/kurse` wird auf `/en/kurse`
umgeleitet statt abgewiesen — unkritisch, Groß-/Kleinschreibung wird normalisiert.

### Regression

**Von PROJ-43 verursacht und behoben (Testebene):** Nach dem Umbau fielen **27 von 34**
bestehenden Tests aus — nicht wegen des Produkts. Playwrights Browser meldet `en-US`, also
griff die Spracherkennung und jeder Test landete auf `/en`, wo er vergeblich nach
„E-Mail" suchte. `playwright.config.ts` steht jetzt auf `de-DE`: Die bestehenden Suiten
prüfen die deutsche Fassung, also treten sie als deutschsprachige Besucher auf.

Das war zugleich der beste Beleg, dass die Spracherkennung wirklich greift.

**Grün danach:** PROJ-6, PROJ-8, PROJ-12, PROJ-14, PROJ-42 zusammen **45 von 45**;
PROJ-41 **17 von 17**; PROJ-9, PROJ-15, PROJ-26, PROJ-27, PROJ-30 zusammen **44 von 45**.

**Nicht von PROJ-43:** Der eine Fehlschlag ist PROJ-15 „Kunde mit bestehendem Abo bekommt keinen"
„Gutschein mehr angerechnet" — derselbe, der bei PROJ-41 auf Commit `078b9f3` (vor jeder
Zeile PROJ-41/42/43-Code) reproduziert wurde. Ursache ist die Doppelanmeldungs-Sperre aus
PROJ-8.

### Automatisierte Tests
- `npm test`: **309 grün** (27 Dateien), darunter 6 neue in
  `src/lib/notifications/templates.i18n.test.ts`. Einer davon vergleicht die Platzhalter
  beider Sprachfassungen — ein vergessenes `{kurs}` wäre sonst erst beim Empfänger
  aufgefallen.
- `tests/PROJ-43-englische-sprachvariante.spec.ts`: **15 grün**, zweimal hintereinander
  gelaufen. Die Suite setzt die Sprache am Konto vor jedem Test zurück.

### Darstellung
375 px, 768 px und 1440 px geprüft: **kein** horizontaler Überlauf (gemessen). Die
englischen Texte laufen nirgends über — sie sind an mehreren Stellen kürzer als die
deutschen.

### Produktionsreife: **NEIN** (zum Zeitpunkt der Prüfung)

BUG-1 war hoch eingestuft: Ein Akzeptanzkriterium war für Handy-Besucher unerreichbar.
Behoben — siehe unten.


_To be added by /qa_

---

## Bugfix nach QA (2026-08-25)

**BUG-1 — Der Sprachumschalter fehlt auf dem Handy**

Er steht jetzt auch im Mobilmenü, durch eine Linie von den Menüpunkten abgesetzt. Der
Klick wechselt die Sprache und lädt die Seite neu, wodurch sich das Menü von selbst
schließt.

Der neue Test geht bewusst den Weg eines Handy-Nutzers: Fenster auf 375 px, prüfen dass der
Umschalter **außerhalb** des Menüs nicht sichtbar ist, Menü öffnen, umschalten, und dann
Adresse und `lang`-Attribut kontrollieren. Damit fällt der Fehler auf, falls er je
zurückkehrt — ein Test, der den Umschalter nur irgendwo auf der Seite sucht, hätte auch die
unsichtbare Desktop-Leiste gefunden.

### Danach
- `tests/PROJ-43-…`: **16 grün**, zweimal hintereinander.
- `npm test` 309 grün, Lint und Build sauber.
- Regression PROJ-6 und PROJ-8 mitgelaufen: zusammen **36 von 36**.

### Produktionsreife: **JA** — keine offenen Befunde

---

## Deployment

**Ausgerollt:** 2026-08-25 · **URL:** https://viennasalsastudio.vercel.app · **Tag:** `v1.43.0-PROJ-43`

Vercel-Build in 59 s, dreizehn Commits (`b4db0f6`…`16b0ad3`).

### Die Datenbankänderungen waren wieder vorab produktiv — diesmal unkritisch
Entwicklung und Produktion teilen sich dieselbe Supabase-Datenbank. Anders als bei PROJ-42
ist das hier folgenlos: Beide Migrationen sind rein **additiv** — eine neue Spalte am Konto,
eine erweiterte Schlüsselspalte bei den Vorlagen. Die ausgerollte App kannte sie nicht und
störte sich nicht an ihnen. Nichts wurde erzwungen, also konnte nichts brechen.

### In der Produktion nachgeprüft
- Deutsche Adressen antworten unverändert: `/`, `/kurse`, `/stundenplan`, `/events`, `/agb`,
  `/login` mit 200, `/profil` leitet wie gehabt auf die Anmeldung
- Ein Browser mit englischer Spracheinstellung landet von `/kurse` auf `/en/kurse`
- `/en`, `/en/kurse`, `/en/agb`, `/en/datenschutz` antworten mit `lang="en"`
- `/en/admin`, `/en/lehrer`, `/xx/kurse` ergeben 404 — Mitarbeiterbereiche und erfundene
  Sprachen haben keine Sprachebene
- Englischer Kurskatalog vollständig, **keine Konsolenfehler**
- Englische AGB mit dem Hinweis auf die verbindliche deutsche Fassung
- Umschalter im Mobilmenü bei 375 px erreichbar
- Eingeloggt umgeschaltet → `profiles.language` steht auf `en`; danach zurückgesetzt

### Nach dem Ausrollen
Kein Kunde hat bisher eine Sprache gewählt (`profiles.language` überall leer) — die 52
Bestandskunden sehen also weiterhin Deutsch, wie beabsichtigt. Wer mit englischem Browser
kommt, sieht ab sofort Englisch.
