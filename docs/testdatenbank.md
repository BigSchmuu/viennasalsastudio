# Testdatenbank

## Warum

Bis zum 27.08.2026 liefen die 376 E2E-Tests gegen die Produktionsdatenbank.
Sie legen Kunden an, buchen Kurse, erzeugen Lastschriftläufe samt Rechnungen
und räumen wieder auf. Solange alle Kunden Freunde waren, war das
Aufräumarbeit — mit echten Mandaten hätte derselbe Lauf eine **echte
Bankdatei mit echten Abbuchungen** erzeugt.

Zusätzlich standen 30 Testkurse im öffentlichen Katalog (samt erfundener
Tanzstile wie „E2E5 Kizomba"), und 44 der 52 Kundenkonten waren Testkonten —
jede Auswertung in der Verwaltung war dadurch verfälscht.

## Aufbau

| | Projekt | Verwendung |
|---|---|---|
| Produktion | `kqdnaevyzgtrmaatinrx` | die echte App |
| Test | `pdlwtlfjqevzslldenel` | E2E-Tests |

Beide in Frankfurt (`eu-central-1`), dieselbe Region wie die Vercel-Funktionen.
Das zweite Projekt kostet nichts.

## Ablauf

```
npm run seed:test     # Testdatenbank aus der Produktion neu befüllen
npm run test:e2e      # Tests laufen ausschliesslich gegen die Testdatenbank
```

Playwright startet seinen **eigenen** Server auf Port 3100 und übernimmt keinen
laufenden. Auf 3000 steht der Entwicklungsserver mit den Produktionsdaten;
mit `reuseExistingServer` hätte Playwright ihn benutzt und stillschweigend
gegen die Produktion getestet.

## Zwei Absicherungen

`tests/env.ts` bricht ab, wenn

- `.env.test` fehlt — ein stiller Rückfall auf `.env.local` wäre genau der
  Unfall, den die Trennung verhindern soll;
- `.env.test` auf die Produktionskennung zeigt.

Beides bricht ab, **bevor** ein einziger Test startet.

## Was im Seed steckt — und was nicht

Kopiert werden Fixtures **mit denselben Kennungen**, damit jede Verknüpfung
erhalten bleibt. Supabase erlaubt beim Anlegen eines Kontos eine vorgegebene
Kennung; ohne das hätte jede Zuordnung neu geknüpft werden müssen.

**Echte Personen bleiben draußen.** Kopiert wird ausschließlich, was zu einem
Konto auf `@viennasalsastudio.test` gehört. Kundennamen, Geburtsdaten und
Bankdaten haben in einer Testdatenbank nichts verloren — sie ist absichtlich
weniger geschützt, und einen Zweck gäbe es ohnehin nicht. Kurse, Standorte und
Säle sind keine personenbezogenen Daten und kommen vollständig mit.

Verweise auf nicht kopierte Konten werden geleert statt mitgenommen: Wer eine
Anwesenheit eingetragen hat, zeigt teils auf echte Lehrer.

## Vier Stolpersteine, die der erste Lauf gefunden hat

- **Zwei Passwörter.** Die PROJ-11-Konten haben ein eigenes. Passwörter liegen
  nur als Prüfwert vor, lassen sich also nicht kopieren.
- **Ein Konto ist absichtlich unbestätigt**, damit PROJ-2 den Hinweis „bitte
  E-Mail bestätigen" prüfen kann.
- **Lastschriftläufe und Rechnungen gehören mit.** PROJ-10 legt einen festen
  Lauf zum 15.01.2028 nur an, wenn es ihn noch nicht gibt, und PROJ-36 rechnet
  mit dessen drei Rechnungen. Ohne ihn im Seed erfasste ein neu angelegter Lauf
  acht statt drei Positionen, weil hier alle Abos und Mandate von Anfang an
  existieren.
- **`process.loadEnvFile` überschreibt bereits gesetzte Werte nicht.** Nach dem
  zweiten Aufruf zeigten Quelle und Ziel beide auf die Produktion; das
  Seed-Skript hätte als Erstes die Produktion geleert. Die Abbruchprüfung hat
  das gefangen.

## Neue Migrationen

In **beide** Projekte einspielen. Die Nachweis-Tabelle der Testdatenbank kennt
alle 91 bisherigen Migrationen, `supabase db push` spielt also nur Neues ein.

## Noch offen

Die Vorschau-Deployments von Vercel zeigen weiterhin auf die
Produktionsdatenbank. Wer dort etwas anklickt, ändert echte Daten. Ein Satz
Umgebungsvariablen je Umgebung in Vercel löst das.
