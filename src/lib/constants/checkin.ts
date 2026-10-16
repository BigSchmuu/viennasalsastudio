/**
 * Wie früh sich jemand selbst für einen Kursabend einchecken darf (PROJ-25).
 *
 * Diese Zahl steht an **zwei** Stellen: hier und in der Datenbankfunktion
 * `self_checkin_course`. Die Datenbank entscheidet, diese Zahl entscheidet nur,
 * ob der Knopf überhaupt erscheint. Laufen sie auseinander, erscheint der Knopf
 * entweder zu früh und wird dann abgewiesen — oder er bleibt weg, obwohl es
 * ginge. Wer sie ändert, ändert beide; die Migration zeigt auf diese Datei.
 *
 * 2026-09-16 von 30 Minuten auf 6 Stunden erhöht: Wer morgens weiß, dass er
 * abends kommt, soll das sagen können, statt bis kurz vor Kursbeginn zu warten.
 */
export const SELF_CHECKIN_VORLAUF_STUNDEN = 6;
export const SELF_CHECKIN_VORLAUF_MINUTEN = SELF_CHECKIN_VORLAUF_STUNDEN * 60;

/**
 * Bis zu welcher Wiener Stunde sich jemand einen heutigen Kursabend noch
 * nachträglich eintragen darf (PROJ-90).
 *
 * Nach oben gab es nie eine Grenze: `self_toggle_attendance` erlaubte den
 * ganzen Kurstag, gesperrt war nur das *Zurücknehmen* nach Kursende. Weg war
 * bloß der Knopf — das Dashboard warf den Termin in der Sekunde des Kursendes
 * aus der Liste. Wer um 21:30 merkte, dass er vergessen hatte zu drücken, fand
 * keine Stelle mehr dafür.
 *
 * 23 Uhr auf Wunsch des Betreibers (2026-10-16): Der Abend ist abgedeckt, und
 * die letzte Stunde des Tages bleibt frei, damit „heute“ und „gestern“ sich an
 * der Tagesgrenze nicht berühren.
 *
 * Auch diese Zahl steht an **zwei** Stellen — hier und in
 * `self_toggle_attendance`. Dieselbe Arbeitsteilung wie oben: Hier entscheidet
 * sie, ob die Karte stehen bleibt, dort entscheidet sie wirklich.
 */
export const SELF_CHECKIN_NACHTRAG_BIS_STUNDE = 23;
