# PROJ-82: Barzahler von Hand eintragen — Kunden ohne eigenes Konto

## Status: Approved
**Created:** 2026-10-13
**Last Updated:** 2026-10-13

## Dependencies
- Requires: PROJ-81 (Barzahler-Liste) — der Ort, an dem eingetragen wird
- Requires: PROJ-50 (Kursplätze) — über das Abo entsteht der Platz im Kurs
- Berührt: PROJ-16 (Benachrichtigungen) — an eine Platzhalter-Adresse geht nichts
- Berührt: PROJ-1 (Profile) — ein Profil hängt an einem Konto

## Anlass

Frage des Betreibers zur Barzahler-Liste: „Kann ich da auch selber Kunden einfügen ohne Profil,
einfach nur mit Namen und Betrag?"

Auf den Papierlisten stehen Leute, die sich nie registriert haben — sie kommen, tanzen und zahlen bar.
In der App gab es sie nicht: Ein Kunde **ist** dort ein Konto, `profiles` hängt an `auth.users`, und
ein Profil entsteht ausschließlich durch eine Registrierung. In der Verwaltung gab es nicht einmal
einen „Kunde anlegen".

Auf die Rückfrage, ob diese Leute auch in der Anwesenheitsliste stehen sollen, lautete die Antwort
**ja, wie jeder andere Teilnehmer**. Damit war die Barzahler-Liste der falsche Ort für die Lösung:
Eine zweite Art von Teilnehmer wäre in Anwesenheit, Kursgrenze und Auswertung je eine Lücke, die man
ihr nicht ansieht.

## User Stories

- Als Lehrkraft möchte ich jemanden, der vor mir steht und bar zahlt, mit Namen und Betrag eintragen
  — ohne nach einer E-Mail-Adresse zu fragen.
- Als Betreiber möchte ich, dass diese Person danach überall mitzählt: Anwesenheit, Kursgrenze,
  Auswertung.
- Als Betreiber möchte ich später eine echte Adresse nachtragen können, ohne die Geschichte zu
  verlieren.
- Als Betreiber möchte ich **nicht**, dass solche Konten Benachrichtigungen erzeugen, die nie
  ankommen können.

## Out of Scope

- **Einladung an eine nachgetragene Adresse.** Trägt die Verwaltung später eine echte Adresse ein,
  wird der Kunde ein gewöhnlicher — die Einladung dazu (Passwort setzen) ist eine eigene Sache.
- **Zusammenführen** zweier Einträge, wenn sich dieselbe Person später selbst registriert. Dann gibt
  es zwei Kunden; das Zusammenlegen ist Handarbeit in der Verwaltung.
- **Ein eigener „Kunde anlegen" in der Kundenverwaltung.** Der Weg führt über den Kurs, in dem die
  Person sitzt — dort steht der Betrag, und dort fällt es auf, wenn jemand doppelt angelegt wird.
- **Telefonnummer und Geburtsdatum** beim Eintragen. Name und Betrag, nicht mehr; der Rest lässt sich
  im Kundenprofil nachtragen.

## Acceptance Criteria

- [ ] Angenommen die Lehrkraft öffnet die Barzahler-Liste, dann gibt es „Barzahler eintragen" mit
      genau zwei Feldern: Name und Betrag.
- [ ] Angenommen sie trägt Name und Betrag ein, dann entsteht ein Kunde mit Kursplatz und diesem
      Beitrag — und er steht sofort in der Barzahler-Liste **und** in der Anwesenheitsliste.
- [ ] Angenommen der Betrag wird mit Komma geschrieben, dann wird er angenommen.
- [ ] Angenommen der Name hat weniger als zwei Zeichen oder der Betrag ist keiner, dann sagt die App
      das — und legt nichts an.
- [ ] Angenommen eine Lehrkraft versucht es für einen Kurs, den sie nicht unterrichtet, dann wird sie
      abgewiesen.
- [ ] Angenommen der Kurs ist voll, dann wird nichts angelegt und die Meldung nennt die Zahlen.
- [ ] Angenommen das Anlegen scheitert auf halbem Weg, dann bleibt **kein** halbes Konto zurück.
- [ ] Angenommen für diesen Kunden entsteht eine Benachrichtigung, dann wird der Versand
      übersprungen — nicht als Fehlschlag gezählt.
- [ ] Angenommen die Verwaltung trägt später eine echte Adresse ein, dann gilt der Kunde als
      gewöhnlicher Kunde, ohne dass irgendwo ein Haken nachzuziehen ist.

## Edge Cases

- **Zwei gleiche Namen** im selben Kurs: möglich. Die App hindert niemanden daran — zwei Menschen
  können gleich heißen. Unterschieden werden sie über das Kundenprofil.
- **Dieselbe Person zweimal eingetragen**: Dann gibt es zwei Kunden mit zwei Plätzen, und der Kurs
  ist um einen Platz voller. Sichtbar in der Teilnehmerliste; aufzulösen in der Verwaltung.
- **Die Person registriert sich später selbst**: zwei Einträge. Bewusst nicht automatisch
  zusammengelegt — eine Vermutung über Identität wäre hier teuer.
- **Kurs ohne Teilnehmergrenze**: Dann gibt es keine Grenze zu prüfen, und es wird eingetragen.
- **Ein Kunde ohne Mandat, der schon ein Abo hat**: Er steht ohnehin in der Liste; ein zweiter
  Eintrag wäre ein zweiter Platz. Dafür ist die Liste da — man sieht ihn.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Ein **echter** Kunde, keine freie Zeile | Entscheidung des Betreibers: „ja, wie jeder andere Teilnehmer". Eine zweite Art von Teilnehmer wäre in Anwesenheit, Kursgrenze und Auswertung je eine Lücke. | 2026-10-13 |
| Lehrkraft **und** Verwaltung dürfen eintragen | Entscheidung des Betreibers. Ein Gast steht am Kursabend vor der Lehrkraft, nicht vor der Verwaltung. | 2026-10-13 |
| Nur Name und Betrag | Mehr Felder an der Kurstür fragt niemand ab. Alles Weitere lässt sich im Kundenprofil nachtragen. | 2026-10-13 |
| Der Kurs bleibt voll, wenn er voll ist | Ein stillschweigend überbuchter Kurs bringt Rollenbalance und Belegungsanzeige durcheinander, ohne dass jemand sieht, woher. Die Meldung nennt die Zahlen, damit die Entscheidung in der Verwaltung fallen kann. | 2026-10-13 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Platzhalter-Adresse auf `.invalid` | Ein Profil braucht ein Konto, ein Konto eine Adresse. `.invalid` ist durch RFC 2606 reserviert und wird nie vergeben — eine erfundene echte Adresse gehört irgendwann jemandem. | 2026-10-13 |
| „Ohne Anmeldung" wird aus der Adresse abgeleitet, nicht aus einem Feld | Trägt die Verwaltung die echte Adresse ein, ist der Kunde damit automatisch ein gewöhnlicher. Ein Feld daneben könnte der Adresse widersprechen — und widersprechende Felder gewinnt immer das falsche. | 2026-10-13 |
| Der Versand überspringt diese Adressen | Sonst landete jede Kurserinnerung in „Nicht zugestellt", bis niemand mehr hinsieht. Übersprungen ist die Wahrheit: Es war nichts zu versuchen. | 2026-10-13 |
| Das Konto entsteht über die Verwaltungs-API, nicht per SQL | Direkt in `auth.users` zu schreiben ist in diesem Projekt eine bekannte Falle: Ohne gesetzte Token-Spalten antwortet die Anmeldung später mit 500 (siehe Notiz zum GoTrue-Verhalten). | 2026-10-13 |
| Geschrieben wird mit dem Dienstschlüssel, die Rechteprüfung steht in der Aktion | Eine Lehrkraft darf weder Konten anlegen noch Abos schreiben. Die Prüfung ist eng: Lehrkraft genau dieses Kurses — gelesen mit ihrem **eigenen** Zugang —, oder Verwaltung. | 2026-10-13 |
| Scheitert ein Schritt, wird das Konto gelöscht | Eine halbe Anlage ist schlimmer als keine: ein Konto ohne Namen ist eine Zeile, die niemand zuordnet. | 2026-10-13 |
| Keine Migration | Es entsteht nichts Neues in der Datenbank — nur ein Kunde, wie es ihn schon gibt. | 2026-10-13 |

---

## Tech Design (Solution Architect)

```
Kursseite im Lehrerbereich → Barzahler → [+ Barzahler eintragen]
   Name | Betrag → [Eintragen]
        │
        ▼
   Konto mit Platzhalter-Adresse (…@viennasalsastudio.invalid)
   + Profil mit dem Namen
   + Abo: dieser Kurs, aktiv, dieser Betrag, ab heute
        │
        ▼
   steht in: Barzahler-Liste · Anwesenheitsliste · Kursgrenze · Auswertung
   bekommt: keine Benachrichtigungen (Versand überspringt .invalid)
```

Kein neues Datenmodell: Die Person ist ein Kunde wie jeder andere, nur ohne erreichbare Adresse. Was
sie von einem registrierten Kunden unterscheidet, steht ausschließlich in dieser Adresse — und
verschwindet, sobald eine echte eingetragen wird.

## QA Test Results (2026-10-14)

**Empfehlung: bereit für die Produktion.** Keine Migration.

| | |
|---|---|
| Regeln (Unit) | 10 für Platzhalter-Adresse, Name und Betrag; 10 für die Absagen der Aktion |
| Browser (E2E) | 2 neu, in Chromium und Mobile Safari grün |
| Gesamt | 1218 Unit- und Datenbankprüfungen grün |
| Produktfehler gefunden | 0 |

### Was geprüft ist

**Die Absagen** — meine eigenen Regeln, deshalb zuerst: Name unter zwei Zeichen, Betrag, der keiner
ist, eine Lehrkraft für einen fremden Kurs, ein voller Kurs (mit Zahlen in der Meldung). In allen
Fällen wird **nichts** angelegt, und das wird ausdrücklich geprüft. Dazu die beiden Abbrüche auf
halbem Weg: Scheitert der Name oder der Kursplatz, wird das Konto wieder gelöscht — ein Konto ohne
Namen ist eine Zeile, die niemand zuordnet.

**Der Weg im Browser**, in beiden Browsern: Die Lehrkraft trägt „Herbert" mit „49,50" ein (mit
Komma — auf einem Handy tippt niemand einen Punkt). Danach steht er in der Barzahler-Liste **und in
der Anwesenheitsliste** — genau das war der Grund, einen echten Kunden anzulegen. Und sein Konto
trägt eine Adresse auf `.invalid`, nachgesehen in der Datenbank.

**Ein unsinniger Betrag** führt zu einer Meldung — und zu keinem Kunden; auch das in der Datenbank
nachgezählt.

### Was offen bleibt

- Trägt die Verwaltung später eine echte Adresse ein, wird der Kunde ein gewöhnlicher. Die
  **Einladung** dazu (Passwort setzen) ist eine eigene Sache und nicht gebaut.
- Registriert sich dieselbe Person später selbst, gibt es zwei Kunden. Bewusst nicht automatisch
  zusammengelegt.


## Deployment
_To be added by /deploy_
