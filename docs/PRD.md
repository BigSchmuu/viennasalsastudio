# Product Requirements Document

## Vision
Vienna Salsa Studio App ist eine Kunden-Self-Service-Plattform für die Tanzschule, die Nimbuscloud vollständig ersetzt. Kunden verwalten ihr Abo, buchen Kurse und Events und schauen Beispiel-Videos eigenständig — ohne dass der Betreiber Kündigungen, Pausen oder Buchungen manuell nachpflegen muss.

## Target Users
- **Tanzschul-Kunden:** Aktuelle und neue Schüler, die Kurse buchen, ihr Abo verwalten (pausieren/kündigen) und sich vorab Kurs-Beispielvideos ansehen wollen — Hauptschmerzpunkt heute: Änderungen am Abo gehen nur per Anruf/Nachricht an den Betreiber.
- **Studio-Betreiber/Admin (du):** Verwaltest Kunden, Kurse, Lehrer, Zahlungen und Events zentral, statt in Nimbuscloud + manuellen Nebenprozessen.
- **Lehrer:** Sehen ihren Stundenplan und verwalten Anwesenheiten für ihre Kurse.

## Core Features (Roadmap)

| Priority | Feature | Status |
|---|---|---|
| P0 (MVP) | Supabase Infrastructure Setup | Deployed |
| P0 (MVP) | Globale Navigation & Login-Status | Deployed |
| P0 (MVP) | Auth & Mitgliederbereich ("Mein Tanzbereich") | Deployed |
| P0 (MVP) | Kurskatalog (Browsing & Filter) | Deployed |
| P0 (MVP) | Kursbuchung (Buchungsanfrage, Probestunde & Drop-in) | Deployed |
| P0 (MVP) | Abo-Verwaltung (Pause/Kündigung Self-Service) | Deployed |
| P0 (MVP) | Stundenplan & Kalender | Deployed |
| P0 (MVP) | SEPA-Lastschriftmandate & Sammel-Einzug | Deployed |
| P0 (MVP) | Rechnungsarchiv | Deployed |
| P0 (MVP) | Beispiel-Videos (YouTube-Einbettung) | Deployed |
| P0 (MVP) | Admin: Kunden-/Mitgliederverwaltung | Deployed |
| P0 (MVP) | Admin: Kurse, Levels, Locations & Tanzstile verwalten | Deployed |
| P0 (MVP) | Warteliste & automatische Nachrückung | Deployed |
| P0 (MVP) | Events & Workshops (Tickets, QR-Check-in) | Deployed |
| P0 (MVP) | Lehrer-Ansicht (Stundenplan, Anwesenheit) | Deployed |
| P0 (MVP) | Gutscheine & Rabattcodes | Deployed |
| P0 (MVP) | Automatische E-Mail-/Push-Benachrichtigungen | Deployed |
| P0 (MVP) | Admin-Analytics (Umsatz, Auslastung, Churn) | Deployed |
| P0 (MVP) | Admin: Lehrer-Rollen verwalten | Deployed |
| P0 (MVP) | Admin: Videosätze & Lektionen verwalten (internes Lehrmaterial) | Deployed |
| P1 | Newsletter-Versand mit Empfängergruppen | Planned |
| P1 | Probestunden-Follow-up & Conversion-Tracking | Planned |
| P1 | Leader/Follower-Auswahl bei Kursbuchung | Planned |
| P1 | Geburtstags-Erinnerung | Planned |
| P1 | Aktive-Kunden-Anzahl im Dashboard | Planned |
| P1 | Sortier- und Filterfunktion für Admin-Listen | Planned |
| P1 | Benachrichtigungs-Texte verwalten | Deployed |
| P1 | Buchhaltungs-Export mit Summen | Deployed |
| P1 | Offene Posten (Rücklastschriften-Übersicht) | Planned |
| P1 | Kursausfall-Benachrichtigung | Planned |
| P1 | Admin-Hinweis auf neue Buchungen | Deployed |
| P1 | Admin auch als Lehrer eintragbar | Planned |
| P2 | Online-Kurs-Plattform (Kapitel, Fortschritt, Quiz, Offline) | Roadmap |
| P2 | Community/Newsfeed | Roadmap |
| P2 | Gamification (Badges, Streaks, Level) | Roadmap |
| P2 | Affiliate-System, granulare Rollen, Dokumente & Verträge | Roadmap |
| P2 | Pagination für Admin-Listen (DB-seitig filtern/sortieren) | Roadmap |

## Success Metrics
- 80%+ der Abo-Änderungen (Pause/Kündigung) laufen über Self-Service statt manuell
- Spürbare Zeitersparnis in der wöchentlichen Verwaltung
- Nimbuscloud kann nach erfolgreicher Testphase vollständig abgeschaltet werden

## Constraints
- Solo-Entwicklung mit Claude Code, kein festes Team
- Zeitrahmen: kein harter Deadline-Druck, Zielhorizont dieses Jahr
- Nimbuscloud bleibt parallel im Einsatz, bis die App voll funktionsfähig ist
- Web-App (Next.js/Vercel), keine native iOS/Android-App
- Design-System: siehe `docs/design-system.md` (Salsa-Rot/Mango-Gold-Branding der bestehenden Website)

## Non-Goals
- Keine native Mobile-App (App Store/Play Store) in dieser Version
- Kein Nimbuscloud-API-Integration — vollständiger Ersatz statt Anbindung
- P2-Features (Online-Kurs-Plattform, Community, Gamification, Affiliate) sind explizit nicht Teil des MVP

## Bekannte technische Schulden

### Pagination für Admin-Listen (PROJ-35, P2)
Die Admin-Listen (v.a. `/admin/kunden`) laden bei jedem Seitenaufruf **alle** Datensätze
und filtern/sortieren erst danach im Speicher, statt in der Datenbank-Abfrage
(`.ilike()` / `.range()` / `.order()`). Der Kurskatalog macht es bereits richtig
(12 pro Seite, „Mehr laden").

**Bewusst zurückgestellt:** Bei aktuell ~50 Kunden ist der Unterschied nicht messbar.

**Auslöser für die Umsetzung:** spürbar ab grob 1.000–2.000 Kunden, oder sobald das Laden
einer Admin-Liste subjektiv träge wird. Vorher besteht kein Risiko — nur später etwas Arbeit.

*Herkunft: externer Code-Audit vom 2026-08-22 (dort Befund P2-2).*
