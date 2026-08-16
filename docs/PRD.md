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
| P0 (MVP) | Auth & Mitgliederbereich ("Mein Tanzbereich") | Deployed |
| P0 (MVP) | Kurskatalog (Browsing & Filter) | Deployed |
| P0 (MVP) | Kursbuchung (Buchungsanfrage, Probestunde & Drop-in) | Planned |
| P0 (MVP) | Abo-Verwaltung (Pause/Kündigung Self-Service) | Roadmap |
| P0 (MVP) | Stundenplan & Kalender | Deployed |
| P0 (MVP) | SEPA-Lastschriftmandate & Sammel-Einzug | Deployed |
| P0 (MVP) | Rechnungsarchiv | Roadmap |
| P0 (MVP) | Beispiel-Videos (YouTube-Einbettung) | Roadmap |
| P0 (MVP) | Admin: Kunden-/Mitgliederverwaltung | Deployed |
| P0 (MVP) | Admin: Kurse, Levels, Locations & Tanzstile verwalten | Deployed |
| P0 (MVP) | Warteliste & automatische Nachrückung | Roadmap |
| P0 (MVP) | Events & Workshops (Tickets, QR-Check-in) | Roadmap |
| P0 (MVP) | Lehrer-Ansicht (Stundenplan, Anwesenheit) | Roadmap |
| P0 (MVP) | Gutscheine & Rabattcodes | Roadmap |
| P0 (MVP) | Automatische E-Mail-/Push-Benachrichtigungen | Roadmap |
| P0 (MVP) | Admin-Analytics (Umsatz, Auslastung, Churn) | Roadmap |
| P0 (MVP) | Admin: Lehrer-Rollen verwalten | Roadmap |
| P0 (MVP) | Admin: Videosätze & Lektionen verwalten (internes Lehrmaterial) | Deployed |
| P2 | Online-Kurs-Plattform (Kapitel, Fortschritt, Quiz, Offline) | Roadmap |
| P2 | Community/Newsfeed | Roadmap |
| P2 | Gamification (Badges, Streaks, Level) | Roadmap |
| P2 | Affiliate-System, granulare Rollen, Dokumente & Verträge | Roadmap |

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
