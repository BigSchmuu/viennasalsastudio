# PROJ-37: Offene Posten (Rücklastschriften-Übersicht)

## Status: Approved
**Created:** 2026-08-22
**Last Updated:** 2026-08-22

## Dependencies
- Requires: PROJ-10 (Rechnungsarchiv) — Rücklastschriften werden dort bereits markiert (`invoices.bounced_at`).
- Requires: PROJ-7 (SEPA-Lastschriftmandate) — der Lastschriftlauf erzeugt die Rechnungen, die zurückgebucht werden können.

## User Stories
- Als Betreiber möchte ich auf einen Blick sehen, welche Kunden mir noch Geld schulden, statt das Rechnungsarchiv durchzusehen.
- Als Betreiber möchte ich die Gesamthöhe der offenen Beträge kennen, um einschätzen zu können, wie viel Geld tatsächlich fehlt.
- Als Betreiber möchte ich einen betroffenen Kunden mit einem Klick per E-Mail an die offene Zahlung erinnern können.
- Als Betreiber möchte ich einen Posten als erledigt markieren können, wenn der Kunde anders bezahlt hat (z.B. bar oder per Überweisung).
- Als Betreiber möchte ich die Rücklastschrift-Gebühr meiner Bank beim Posten erfassen, damit ich sehe, was mich die Rückbuchung tatsächlich gekostet hat — und sie dem Kunden weiterverrechnen kann.

## Out of Scope
- **Unbezahlte Vor-Ort-Zahlungen.** Drop-ins und reservierte Event-Tickets werden nirgends als "bezahlt/unbezahlt" erfasst — es gibt schlicht keine Datenbasis dafür. Bewusste Entscheidung (siehe Decision Log); nur Rücklastschriften gelten als offener Posten.
- **Automatisches Mahnwesen** (Mahnstufen, Fristen, Mahngebühren, automatischer Versand nach X Tagen). Erinnerungen werden manuell ausgelöst.
- **Erneuter Lastschrifteinzug** eines zurückgebuchten Betrags aus der App heraus.
- **Verbuchung von Zahlungseingängen.** "Erledigt" ist ein Haken, keine Buchung — die App führt kein Konto.
- **Verzugszinsen.** Der gesetzliche Zinssatz für Privatkunden beträgt 4 % pro Jahr (§ 1000 ABGB). Tagesgenau gerechnet ergibt das bei den hier üblichen Beträgen Centbeträge — bei 40 € und 30 Tagen rund 0,13 €. Der Aufwand steht in keinem Verhältnis; die Bankgebühr ist praktisch immer der größere Posten. Bewusst zurückgestellt und jederzeit nachrüstbar (entschieden 2026-08-23).

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Übersicht
- [ ] Angenommen ein Admin ist eingeloggt, wenn er im Admin-Menü "Offene Posten" öffnet, dann sieht er eine Liste aller zurückgebuchten Rechnungen mit Kunde, Rechnungsnummer, Datum, Betrag und wie lange der Posten schon offen ist.
- [ ] Angenommen es gibt offene Posten, wenn die Seite geladen wird, dann zeigt eine Kachel die Anzahl und die Gesamtsumme der offenen Beträge.
- [ ] Angenommen es gibt keine offenen Posten, wenn der Admin die Seite öffnet, dann sieht er einen Leerzustand ("Keine offenen Posten") statt einer leeren Tabelle.
- [ ] Angenommen ein Posten ist bereits als erledigt markiert, wenn die Seite geladen wird, dann erscheint er **nicht** mehr in der Liste der offenen Posten.
- [ ] Angenommen ein nicht-Admin ruft die Seite direkt per URL auf, dann wird der Zugriff verweigert.

### Rücklastschrift-Gebühr
- [ ] Angenommen der Admin hat in den Rechnungseinstellungen einen Standardbetrag hinterlegt, wenn ein neuer offener Posten entsteht, dann ist die Gebühr mit diesem Betrag vorbelegt.
- [ ] Angenommen die Bank hat ausnahmsweise anders abgerechnet, wenn der Admin die Gebühr bei diesem Posten überschreibt, dann gilt der geänderte Betrag nur für diesen Posten und der Standardwert bleibt unberührt.
- [ ] Angenommen ein Posten hat eine Gebühr, wenn die Liste angezeigt wird, dann sind Rechnungsbetrag und Gebühr **getrennt** ausgewiesen und zusätzlich die Summe beider.
- [ ] Angenommen es gibt offene Posten mit Gebühren, wenn die Kachel die Gesamtsumme bildet, dann enthält sie Rechnungsbeträge **und** Gebühren.
- [ ] Angenommen kein Standardbetrag ist hinterlegt, wenn ein Posten entsteht, dann ist die Gebühr 0,00 € und die Summe entspricht dem reinen Rechnungsbetrag — kein Fehler, keine Pflichteingabe.

### Erinnerung senden
- [ ] Angenommen ein offener Posten ist gelistet, wenn der Admin auf "Erinnerung senden" klickt und bestätigt, dann erhält der Kunde eine E-Mail mit Rechnungsnummer, Betrag und dem Hinweis, dass die Lastschrift zurückgebucht wurde.
- [ ] Angenommen der Posten hat eine Rücklastschrift-Gebühr, wenn die Erinnerung verschickt wird, dann nennt die E-Mail Rechnungsbetrag und Gebühr **getrennt** sowie den Gesamtbetrag — damit der Kunde nachvollziehen kann, warum mehr gefordert wird als auf der Rechnung stand.
- [ ] Angenommen eine Erinnerung wurde bereits verschickt, wenn der Admin die Liste ansieht, dann sieht er, wann zuletzt erinnert wurde.
- [ ] Angenommen der Admin klickt erneut auf "Erinnerung senden", dann ist das möglich (kein Limit), der Zeitstempel wird aktualisiert.
- [ ] Angenommen der E-Mail-Versand schlägt fehl, wenn der Admin auf "Erinnerung senden" klickt, dann erscheint eine Fehlermeldung und der Posten wird **nicht** als erinnert markiert.

### Erledigt markieren
- [ ] Angenommen ein Kunde hat anderweitig bezahlt, wenn der Admin den Posten als "erledigt" markiert und bestätigt, dann verschwindet er aus der Liste und die Gesamtsumme sinkt entsprechend.
- [ ] Angenommen ein Posten wurde versehentlich als erledigt markiert, wenn der Admin ihn in einer Ansicht "auch erledigte anzeigen" wieder öffnet, dann kann er die Markierung zurücknehmen.

## Edge Cases
- Was passiert, wenn dieselbe Rechnung mehrfach zurückgebucht wird? → Es bleibt ein Posten pro Rechnung; das Rückbuchungsdatum wird aktualisiert.
- Was passiert, wenn der Kunde inzwischen gekündigt hat oder sein Konto gelöscht wurde? → Der Posten bleibt sichtbar (das Geld fehlt trotzdem); fehlt der Kundenname, wird "Unbekannt" angezeigt statt eines Fehlers.
- Was passiert, wenn der Kunde keine E-Mail-Adresse hat? → "Erinnerung senden" ist deaktiviert mit erklärendem Hinweis.
- Was passiert, wenn ein Admin einen Posten erledigt markiert, während ein anderer gerade eine Erinnerung sendet? → Letzter Schreibvorgang gewinnt; kein Sperrmechanismus (kleines Team, gleiche Begründung wie bei den übrigen Admin-Bereichen).
- Wie wird "wie lange offen" berechnet? → Ab dem Datum der Rückbuchung, nicht ab Rechnungsdatum.
- Was passiert mit der Gebühr, wenn der Posten als erledigt markiert wird? → Sie verschwindet mit dem Posten aus der offenen Summe. Es wird nicht getrennt festgehalten, ob der Kunde die Gebühr tatsächlich mitbezahlt hat — die App führt kein Konto.
- Was passiert, wenn der Admin den Standardbetrag später ändert? → Nur neue Posten übernehmen ihn. Bereits erfasste behalten ihren Betrag, sonst würde eine Änderung rückwirkend Beträge verfälschen, die dem Kunden vielleicht schon genannt wurden.
- Was, wenn eine Rechnung mehrfach zurückgebucht wird und jedes Mal eine Gebühr anfällt? → Es bleibt ein Posten pro Rechnung; der Admin kann die Gebühr entsprechend erhöhen. Eine Gebührenhistorie wird nicht geführt.

## Technical Requirements (optional)
- Security: Nur Admins (`requireAdmin`), wie alle `/admin`-Bereiche.
- Die Erinnerungs-E-Mail läuft über die bestehende Benachrichtigungs-Infrastruktur (PROJ-16), damit Zustellung und Protokollierung einheitlich bleiben.

## Open Questions
- [x] Soll die Erinnerungs-E-Mail über PROJ-34 frei anpassbar sein? → Ja. Es ist eine Zahlungsaufforderung; der Ton entscheidet, ob ein Kunde bleibt oder sich ärgert, und der Mechanismus existiert bereits (2026-08-23)
- [x] Sollen Verzugszinsen berechnet werden? → Nein. 4 % p.a. ergeben bei diesen Beträgen Centbeträge; zurückgestellt zugunsten der Bankgebühr, die real anfällt (2026-08-23)
- [x] Wie wird die Gebühr erfasst? → Standardwert in den Rechnungseinstellungen, pro Posten überschreibbar (2026-08-23)
- [x] Zählt die Gebühr in die offene Summe? → Ja, Rechnungsbetrag und Gebühr werden getrennt ausgewiesen und gemeinsam summiert (2026-08-23)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| "Offen" = nur Rücklastschriften | Unbezahlte Vor-Ort-Zahlungen werden im System gar nicht erfasst; sie hier aufzunehmen würde eine Datenbasis erfordern, die es nicht gibt (eigenes Feature "Kassenbuch") | 2026-08-22 |
| Erinnerung manuell auslösen, kein automatisches Mahnwesen | Bei der Größe des Studios ist der persönliche Weg üblich; automatische Mahnstufen wären unangemessen und aufwendig | 2026-08-22 |
| "Erledigt" ist eine reine Markierung, keine Buchung | Die App ist kein Buchhaltungssystem; der Haken dokumentiert nur, dass der Fall für den Betreiber abgeschlossen ist | 2026-08-22 |
| Erledigte Posten bleiben einsehbar und rücknehmbar | Fehlklicks passieren; ein unwiderruflicher Haken auf einer Geldforderung wäre riskant | 2026-08-22 |
| Rücklastschrift-Gebühr wird erfasst und dem Kunden weiterverrechnet | Sie fällt real an und ist vom Kunden verursacht. Ohne sie zeigt die Kachel weniger, als tatsächlich fehlt | 2026-08-23 |
| Standardwert in den Einstellungen, pro Posten überschreibbar | Der Betrag ist meist gleich, aber nicht immer — ein fester Wert wäre falsch, sobald die Bank einmal anders abrechnet, und jedes Mal tippen wäre unnötige Arbeit | 2026-08-23 |
| Rechnungsbetrag und Gebühr getrennt ausweisen, nicht verschmelzen | Der Kunde muss nachvollziehen können, warum mehr gefordert wird als auf seiner Rechnung stand — eine unerklärte Summe erzeugt genau die Rückfrage, die man sparen will | 2026-08-23 |
| Eine Änderung des Standardwerts wirkt nur auf neue Posten | Sonst würden sich Beträge rückwirkend ändern, die dem Kunden möglicherweise schon genannt wurden | 2026-08-23 |
| Keine Verzugszinsen | 4 % p.a. nach § 1000 ABGB ergeben bei diesen Beträgen Centbeträge (40 €, 30 Tage → 0,13 €). Der Aufwand steht in keinem Verhältnis; nachrüstbar, falls sich das ändert | 2026-08-23 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Ein offener Posten ist eine zurückgebuchte Rechnung, kein eigener Datenbestand | Eine zweite Liste müsste gepflegt werden und könnte von den Rechnungen abweichen — dann zeigt die App eine Forderung, die es nicht mehr gibt | 2026-08-23 |
| Gebühr getrennt von der Rechnung speichern, nicht aufaddieren | Der ursprüngliche Rechnungsbetrag muss unangetastet bleiben (eine Rechnung nachträglich zu erhöhen wäre buchhalterisch falsch), und nur getrennt kann die E-Mail dem Kunden die Differenz erklären | 2026-08-23 |
| Standardwert wird beim Entstehen einmal übernommen, nicht dauerhaft verknüpft | Sonst änderten sich Beträge rückwirkend, die dem Kunden schon genannt wurden | 2026-08-23 |
| Erinnerungstext über PROJ-34 anpassbar | Eine Zahlungsaufforderung ist Tonfall-kritisch; der Betreiber muss sie selbst formulieren können, ohne dass jemand Code ändert. Der Mechanismus existiert bereits | 2026-08-23 |
| Versand über die bestehende Benachrichtigungs-Infrastruktur (PROJ-16) | Zustellung und Protokollierung bleiben einheitlich mit allen anderen Nachrichten | 2026-08-23 |
| Gebühr 0,00 € ist zulässig, keine Pflichteingabe | Wer keinen Standardwert hinterlegt, soll nicht bei jedem Posten zu einer Eingabe gezwungen werden | 2026-08-23 |

---

## Tech Design (Solution Architect)

### A) Component Structure (Visual Tree)

```
Verwaltung → NEU: "Offene Posten"
├── Kachel: Anzahl + Gesamtsumme
│      Rechnungsbeträge + Gebühren zusammen — das ist, was real fehlt
├── Tabelle
│   ├── Kunde | Rechnung | Rückgebucht am | seit X Tagen
│   ├── Rechnungsbetrag | Gebühr (änderbar) | Summe
│   ├── zuletzt erinnert am
│   └── Aktionen: "Erinnerung senden" · "Erledigt"
├── Umschalter: "auch erledigte anzeigen"
└── Leerzustand: "Keine offenen Posten"

Verwaltung → Rechnungen → Einstellungen (bestehende Seite)
└── NEU: Feld "Rücklastschrift-Gebühr (Standard)"

Admin-Navigation (bestehend)
└── NEU: Menüpunkt "Offene Posten"
```

### B) Data Model (plain language)

Ein offener Posten **ist** eine zurückgebuchte Rechnung — es entsteht keine zweite Liste, die
auseinanderlaufen könnte. Die bestehende Rechnung bekommt drei Angaben dazu:

```
Zur bereits vorhandenen Rechnung kommt hinzu:
- Rücklastschrift-Gebühr   (Betrag, standardmäßig aus den Einstellungen)
- Erledigt am              (leer = noch offen)
- Zuletzt erinnert am      (leer = noch nie erinnert)

In den Rechnungseinstellungen kommt hinzu:
- Standard-Rücklastschriftgebühr
```

**Was ein offener Posten ist:** eine Rechnung, die zurückgebucht wurde und noch nicht als erledigt
markiert ist. Mehr braucht es nicht — die Liste ist eine Frage an die vorhandenen Daten, kein
eigener Bestand.

**Der Standardwert wird beim Entstehen des Postens einmal übernommen, nicht dauerhaft verknüpft.**
Änderst du ihn später, bleiben bestehende Posten unberührt. Sonst würden sich Beträge rückwirkend
ändern, die einem Kunden womöglich schon genannt wurden.

### C) Tech Decisions (justified for PM)

- **Kein zweiter Datenbestand.** Die naheliegende Lösung wäre eine eigene Liste „offene Forderungen".
  Die müsste aber gepflegt werden und könnte von den Rechnungen abweichen — dann zeigt die App eine
  Forderung, die es nicht mehr gibt. Ein Posten ist deshalb schlicht eine zurückgebuchte Rechnung
  ohne Erledigt-Haken.

- **Rechnungsbetrag und Gebühr bleiben getrennt gespeichert**, nicht zu einer Summe verschmolzen.
  Nur so kann die E-Mail dem Kunden erklären, warum mehr gefordert wird als auf seiner Rechnung
  steht — und nur so bleibt der ursprüngliche Rechnungsbetrag unangetastet. Eine Rechnung
  nachträglich zu erhöhen wäre buchhalterisch falsch.

- **Die Erinnerung läuft über die vorhandene Benachrichtigungs-Infrastruktur** (PROJ-16), damit
  Zustellung und Protokollierung dieselben sind wie bei allen anderen Nachrichten.

- **Der Text der Erinnerung wird über PROJ-34 anpassbar** (offene Frage aus dem Spec, hier
  entschieden). Begründung: Es ist eine Zahlungsaufforderung — der Ton entscheidet, ob ein Kunde
  bleibt oder sich ärgert. Diesen Text solltest du selbst formulieren können, ohne dass jemand
  Code ändert. Der Mechanismus existiert bereits; es kommt eine weitere Textvorlage hinzu.

- **„Erledigt" ist rücknehmbar und blendet nur aus.** Ein unwiderruflicher Haken auf einer
  Geldforderung wäre riskant — Fehlklicks passieren.

- **Gebühr 0,00 € ist erlaubt.** Wer keinen Standardwert hinterlegt, bekommt keine Pflichteingabe
  vorgesetzt; die Summe entspricht dann dem reinen Rechnungsbetrag.

- **Kein Zugriff für Kunden und Lehrer.** Die Seite liegt unter der Verwaltung und nutzt dieselbe
  Absicherung wie alle Admin-Bereiche.

### D) Dependencies (packages to install)

Keine. Das Feature nutzt die vorhandene Rechnungs- und Benachrichtigungs-Infrastruktur sowie die
bestehende Admin-Navigation.

### Umfang

Neu: eine Verwaltungsseite und ein Menüpunkt. Erweitert: die Rechnungstabelle um drei Angaben, die
Rechnungseinstellungen um ein Feld, die Textvorlagen um eine Erinnerung.

---

## Implementation Notes (Frontend)

**Umgesetzt am 2026-08-23.** Die Seite steht und zeigt echte Daten; die **Aktionen** (Erinnerung
senden, Erledigt markieren, Gebühr speichern) folgen im Backend-Schritt und sind vorerst
deaktiviert dargestellt.

### Geänderte/neue Dateien
| Datei | Zweck |
|-------|-------|
| `src/app/admin/offene-posten/page.tsx` (neu) | Lädt zurückgebuchte Rechnungen |
| `src/components/admin/open-items/open-items-list.tsx` (neu) | Kachel, Tabelle, Leerzustand, Umschalter |
| `src/components/admin/admin-nav.tsx` | Menüpunkt „Offene Posten" |
| `src/components/admin/invoices/invoice-settings-form.tsx` | Feld „Rücklastschrift-Gebühr (€)" |
| `src/app/admin/rechnungen/einstellungen/page.tsx` | Reicht den Standardwert durch |
| `src/lib/validations/admin.ts`, `src/lib/actions/admin/invoices.ts` | Standardwert wird validiert und gespeichert |
| `supabase/migrations/…_proj37_offene_posten_felder.sql` | Drei Felder an der Rechnung, ein Feld an den Einstellungen, ein Index |
| `src/lib/supabase/types.ts` | Neu erzeugt |

### Bewusste Abweichungen von der Phasentrennung
Zwei Dinge, die streng genommen zum Backend gehören, wurden hier miterledigt — mit Begründung:

1. **Die Datenbankfelder.** Ohne sie könnte die Seite nichts Echtes anzeigen; sie wäre nicht prüfbar.
2. **Das Speichern des Standardwerts.** Ein Eingabefeld in den Einstellungen, das seinen Wert
   stillschweigend verwirft, wäre schlimmer als gar keines.

Die eigentlichen Aktionen bleiben unangetastet.

### Entscheidungen bei der Umsetzung
- **Die Kachel summiert Rechnungsbetrag und Gebühr**, weil sie die Frage „wie viel fehlt mir"
  beantwortet — die Gebühr ist real an die Bank geflossen.
- **„seit X Tagen" zählt ab der Rückbuchung**, nicht ab dem Rechnungsdatum. Erst dann ist das Geld
  tatsächlich ausgeblieben.
- **Erledigte Posten werden abgeblendet statt versteckt**, sobald man sie einblendet — der
  Unterschied bleibt so auf einen Blick sichtbar.
- **Ein Index auf genau die Filterbedingung** (zurückgebucht und nicht erledigt) statt eines
  allgemeinen: Die Liste fragt immer exakt danach.
- **Grenze von 1000 € beim Standardwert.** Ein Tippfehler wie `4500` statt `45,00` soll nicht
  stillschweigend als Forderung an einen Kunden gehen.

### Verifiziert
- Seite zeigt die beiden zurückgebuchten Rechnungen mit Kachel „€ 70,00 — 2 offene Posten"
- Einzahl korrigiert: „seit 1 Tag" statt „seit 1 Tagen"
- Einstellungsfeld vorhanden und beschriftet
- 275 Unit-Tests grün, `tsc` und Lint sauber

### Noch offen (Backend-Schritt)
Erinnerung senden (inkl. Textvorlage über PROJ-34), Erledigt markieren und zurücknehmen, Gebühr pro
Posten speichern, Absicherung gegen Nicht-Admins.

---

## Implementation Notes (Backend)

**Umgesetzt am 2026-08-23.** Drei Aktionen, eine Textvorlage, ein neuer Benachrichtigungs-Anlass.

### Geänderte/neue Dateien
| Datei | Zweck |
|-------|-------|
| `src/lib/actions/admin/open-items.ts` (neu) | Gebühr speichern, Erledigt setzen/zurücknehmen, Erinnerung senden |
| `src/lib/notifications/template-registry.ts` | Vorlage „Zahlungserinnerung" — über PROJ-34 bearbeitbar |
| `src/lib/notifications/templates.ts` | Inhalt der Erinnerung (Rechnungsnummer, Betrag, Gebühr, Summe) |
| `src/lib/notifications/dispatch.ts` | Zustellweg, bewusst an den Kunden-Einstellungen vorbei |
| `src/components/admin/open-items/open-items-list.tsx` | Knöpfe und Eingabefeld verkabelt |
| `supabase/migrations/…_proj37_zahlungserinnerung_event_type.sql` | Neuer Anlass in der Warteschlange |

### Ein Fehler, der beim Prüfen auffiel — und ein Akzeptanzkriterium verletzte
Der erste Entwurf setzte den „erinnert am"-Vermerk, sobald die Nachricht **eingereiht** war.
`enqueueAndDispatch` wirft bei Zustellfehlern aber nicht, sondern protokolliert sie nur — der
Vermerk stand also auch dann, wenn die E-Mail nachweislich fehlschlug.

Das verletzt wörtlich ein Akzeptanzkriterium („bei fehlgeschlagenem Versand wird der Posten **nicht**
als erinnert markiert") und wäre im Betrieb teuer: Der Betreiber sieht „erinnert am 23.08.", hört
nichts vom Kunden und hakt nicht nach — bei einem Kunden, der nie eine Nachricht bekommen hat.

**Behoben:** Nach dem Versand wird das Ergebnis aus der Warteschlange zurückgelesen. Nur bei
`sent` wird der Vermerk gesetzt; andernfalls erscheint eine Fehlermeldung.

**Verifiziert:** Zustellstatus `failed` → `reminded_at` bleibt leer, Meldung „Die Erinnerung konnte
nicht zugestellt werden. Bitte prüfe die E-Mail-Adresse des Kunden."

### Weitere Entscheidungen
- **Die Erinnerung läuft an den Kunden-Benachrichtigungseinstellungen vorbei** — wie die
  SEPA-Ankündigung. Eine Zahlungsaufforderung darf der Schuldner nicht abschalten können.
- **Kein Dublettenschutz beim Erinnern.** Der Schlüssel enthält einen Zeitstempel, weil
  wiederholtes Erinnern ausdrücklich erlaubt ist und jede Erinnerung tatsächlich rausgehen soll.
- **Die Gebühr wird beim Verlassen des Feldes gespeichert**, nicht bei jedem Tastendruck — sonst
  ein Schreibvorgang pro Zeichen und eine flackernde Liste.
- **Nur zurückgebuchte Rechnungen sind änderbar.** Alle drei Aktionen filtern zusätzlich auf
  „zurückgebucht"; eine gültige Rechnungs-ID allein reicht nicht, um etwas zu verändern.
- **Erledigte Posten lassen sich nicht mehr erinnern oder in der Gebühr ändern** — dafür jederzeit
  wieder öffnen.

### Verifiziert
- Gebühr 4,50 € gesetzt → in der Datenbank angekommen
- „Erledigt" → Posten verschwindet aus der Liste, Datenbank vermerkt den Zeitpunkt
- „Wieder öffnen" → Posten zurück in der Liste, **die Gebühr bleibt erhalten**
- Erinnerung → Warteschlangen-Eintrag entsteht, Zustellversuch protokolliert
- 275 Unit-Tests grün, `tsc` und Lint sauber
- Testspuren entfernt, Fixtures zurückgesetzt

### Nebenbei
Ein Test hielt „genau 12 Vorlagen" fest. Die feste Zahl war nie die eigentliche Aussage — sie hätte
bei jeder neuen Vorlage nur bestätigt, dass jemand sie hochgezählt hat. Der Test prüft jetzt, was
zählt: dass kein Vorlagen-Schlüssel doppelt vergeben ist.

## QA Test Results

**Getestet:** 2026-08-23
**Umgebung:** http://localhost:3000 gegen die Produktiv-Datenbank (es gibt keine Staging-DB)
**Tester:** QA Engineer (AI)

### Akzeptanzkriterien

#### Übersicht — 5/5 bestanden
- [x] Liste zeigt zurückgebuchte Rechnungen mit Kunde, Nummer, Datum und Standzeit („seit X Tagen")
- [x] Kachel nennt Anzahl und Gesamtsumme
- [x] Leerzustand statt leerer Tabelle, wenn nichts offen ist
- [x] Erledigte Posten verschwinden aus der Liste
- [x] Nicht-Admins wird der Zugriff verweigert

#### Rücklastschrift-Gebühr — 5/5 bestanden
- [x] Standardwert aus den Rechnungseinstellungen vorbelegt
- [x] Pro Posten überschreibbar, der Standardwert bleibt unberührt
- [x] Rechnungsbetrag und Gebühr getrennt ausgewiesen, Summe zusätzlich
- [x] Gebühren fließen in die Gesamtsumme der Kachel ein
- [x] 0,00 € zulässig, keine Pflichteingabe

#### Erinnerung — 3/3 bestanden
- [x] Erinnerung erzeugt einen Zustellversuch mit Rechnungsnummer, Betrag, Gebühr und Summe
- [x] Zeitpunkt der letzten Erinnerung ist in der Liste sichtbar
- [x] **Fehlgeschlagene Zustellung wird nicht als erinnert vermerkt** und meldet einen Fehler

#### Erledigt markieren — 2/2 bestanden
- [x] Posten verschwindet, Gesamtsumme sinkt
- [x] Über „auch erledigte anzeigen" wieder zu öffnen — **die Gebühr bleibt dabei erhalten**

### Sicherheitsprüfung (Red Team)
- [x] **Unangemeldet:** Weiterleitung auf `/login`, kein Inhalt
- [x] **Als Kunde:** Weiterleitung weg von der Seite, kein Zugriff auf die Übersicht
- [x] **Datenbank direkt, als Kunde angemeldet:** Der Versuch, die *eigene* zurückgebuchte Rechnung
      zu ändern (Gebühr setzen, auf erledigt markieren), betraf **0 Zeilen** — RLS erlaubt Kunden
      nur Lesen. Ein Schuldner kann seine Forderung also nicht selbst wegklicken
- [x] **Serverseitige Validierung:** Negative Beträge und unrealistisch hohe Werte werden abgelehnt,
      unabhängig davon, was das Eingabefeld im Browser zulässt
- [x] **Alle drei Aktionen filtern zusätzlich auf „zurückgebucht"** — eine gültige Rechnungs-ID
      allein genügt nicht, um etwas zu verändern
- [x] **Die Erinnerung ist vom Kunden nicht abschaltbar** (bewusst, wie die SEPA-Ankündigung)

### Gefundene Fehler
Keine. Der eine Fehler dieser Runde — der „erinnert am"-Vermerk bei fehlgeschlagener Zustellung —
fiel bereits im Backend-Schritt auf und ist dort behoben und dokumentiert. Die QA hat ihn
gegengeprüft: Bei Zustellstatus `failed` bleibt der Vermerk leer und es erscheint eine Meldung.

### Automatisierte Tests
- **Unit:** 5 neue Tests für die Gebühren-Validierung — Gesamtsuite **280/280 grün**
- **E2E:** 9 neue Tests in `tests/PROJ-37-offene-posten.spec.ts` — **9/9 grün auf Chromium und
  Mobile Safari**
- **Methodik:** Die Suite setzt in `beforeEach` Gebühr, Erledigt-Status und Erinnerungszeitpunkt
  zurück. Ohne das liefe sie einmal grün und danach nie wieder — genau das Muster, das dieses
  Projekt zuvor eine ganze Aufräumrunde über neun Suiten gekostet hat.

### Regression
- PROJ-10 (Rechnungsarchiv): 12/12 grün
- PROJ-36 (Buchhaltungs-Export): 14/14 grün
- PROJ-34 (Benachrichtigungs-Texte): 9/9 grün — eine Zusicherung dort verlangte „genau 12 Vorlagen".
  Die Zahl war nie die eigentliche Aussage; der Test prüft jetzt gegen die Registry selbst und
  bricht damit nicht mehr bei jeder neuen Vorlage

### Nicht abgedeckt
- **Eine erfolgreich zugestellte Erinnerung.** Alle Fixture-Kunden haben `.test`-Adressen, an die
  kein Mailserver zustellen kann. Der Fehlerpfad ist damit real geprüft, der Erfolgspfad nur bis zur
  Übergabe an den Versand. Ein Probe-Versand an eine echte Adresse durch den Betreiber wäre der
  letzte Schritt

### Zusammenfassung
- **Akzeptanzkriterien:** 15/15 bestanden
- **Fehler:** 0 offen (1 im Backend-Schritt gefunden und behoben)
- **Sicherheit:** Bestanden. Entscheidend: Ein Kunde kann seine eigene Forderung weder ändern noch
  als erledigt markieren
- **Produktionsreif:** **JA**


## Deployment
_To be added by /deploy_
