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
