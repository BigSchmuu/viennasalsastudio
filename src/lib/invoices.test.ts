import { describe, it, expect } from "vitest";
import { computeInvoiceAmounts, toCsvField, toCsvRow, monthRange, monthFromRange, monthLabel, recentMonths, summarizeInvoices, exportFileName, formatAmountDe, CSV_SEPARATOR, yearRange, yearFromRange, recentYears, selectionFromRange, rangeFromSelection } from "./invoices";

describe("computeInvoiceAmounts", () => {
  it("splits a gross amount into net + VAT at 20%", () => {
    const { netAmount, vatAmount, grossAmount } = computeInvoiceAmounts(45, 20);
    expect(grossAmount).toBe(45);
    expect(netAmount).toBe(37.5);
    expect(vatAmount).toBe(7.5);
    expect(Math.round((netAmount + vatAmount) * 100) / 100).toBe(45);
  });

  it("returns the full amount as net when the VAT rate is 0", () => {
    const { netAmount, vatAmount } = computeInvoiceAmounts(45, 0);
    expect(netAmount).toBe(45);
    expect(vatAmount).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    const { netAmount, vatAmount } = computeInvoiceAmounts(10, 13);
    expect(netAmount).toBeCloseTo(8.85, 2);
    expect(vatAmount).toBeCloseTo(1.15, 2);
  });
});

describe("toCsvField", () => {
  it("returns a plain field unquoted", () => {
    expect(toCsvField("2026-0001")).toBe("2026-0001");
  });

  // Seit PROJ-36 trennt die Datei mit Semikolon. Ein Komma ist damit ein
  // gewöhnliches Zeichen und braucht keine Anführungszeichen mehr — ein
  // Semikolon dafür sehr wohl.
  it("quotes and escapes a field containing the separator", () => {
    expect(toCsvField("Muster; Anna")).toBe('"Muster; Anna"');
    expect(toCsvField("Muster, Anna")).toBe("Muster, Anna");
  });

  it("quotes and escapes internal double quotes", () => {
    expect(toCsvField('Say "hi"')).toBe('"Say ""hi"""');
  });

  it("neutralizes a leading = to prevent formula injection (CWE-1236)", () => {
    expect(toCsvField("=1+1")).toBe("'=1+1");
  });

  it("neutralizes a leading formula-triggering =HYPERLINK payload", () => {
    expect(toCsvField('=HYPERLINK("http://evil.example","click")')).toBe(
      '"\'=HYPERLINK(""http://evil.example"",""click"")"'
    );
  });

  it("neutralizes leading +, -, and @ as well", () => {
    expect(toCsvField("+1+1")).toBe("'+1+1");
    expect(toCsvField("-1+1")).toBe("'-1+1");
    expect(toCsvField("@SUM(1,1)")).toBe("'@SUM(1,1)");
  });

  it("does not touch an invoice number that happens to contain a dash mid-string", () => {
    expect(toCsvField("2026-0001")).toBe("2026-0001");
  });
});

describe("toCsvRow", () => {
  it("joins fields with semicolons, quoting where necessary", () => {
    expect(toCsvRow(["2026-0001", "Muster; Anna", 45.0])).toBe('2026-0001;"Muster; Anna";45');
  });
});

describe("Monatsauswahl für den Export (PROJ-36)", () => {
  it("spannt einen Monat vom ersten bis zum letzten Tag auf", () => {
    expect(monthRange("2026-08")).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(monthRange("2026-04")).toEqual({ from: "2026-04-01", to: "2026-04-30" });
  });

  // Februar ist der Fall, den man von Hand falsch macht.
  it("kennt die Länge des Februars, auch im Schaltjahr", () => {
    expect(monthRange("2026-02")?.to).toBe("2026-02-28");
    expect(monthRange("2028-02")?.to).toBe("2028-02-29");
  });

  it("weist unsinnige Eingaben ab, statt ein falsches Datum zu erfinden", () => {
    expect(monthRange("2026-13")).toBeNull();
    expect(monthRange("2026-00")).toBeNull();
    expect(monthRange("August 2026")).toBeNull();
    expect(monthRange("")).toBeNull();
  });

  it("erkennt einen vollständigen Monat in einem Von/Bis-Paar wieder", () => {
    expect(monthFromRange("2026-08-01", "2026-08-31")).toBe("2026-08");
    expect(monthFromRange("2028-02-01", "2028-02-29")).toBe("2028-02");
  });

  // Wichtiger als der Positivfall: Ein handgesetzter Zeitraum darf nicht als
  // Monat durchgehen, sonst behauptet die Auswahl etwas Falsches.
  it("behandelt angebrochene oder übergreifende Zeiträume als eigenen Zeitraum", () => {
    expect(monthFromRange("2026-08-01", "2026-08-30")).toBeNull();
    expect(monthFromRange("2026-08-02", "2026-08-31")).toBeNull();
    expect(monthFromRange("2026-08-01", "2026-09-30")).toBeNull();
    expect(monthFromRange("", "")).toBeNull();
  });

  it("beschriftet Monate auf Deutsch", () => {
    expect(monthLabel("2026-08")).toBe("August 2026");
    expect(monthLabel("2026-03")).toBe("März 2026");
  });

  it("listet den aktuellen Monat zuerst und zählt rückwärts über den Jahreswechsel", () => {
    const months = recentMonths(3, new Date(2026, 0, 15)); // Januar 2026
    expect(months.map((m) => m.value)).toEqual(["2026-01", "2025-12", "2025-11"]);
    expect(months[0].label).toBe("Januar 2026");
  });
});

describe("Summen für den Buchhaltungs-Export (PROJ-36)", () => {
  const bezahlt = (gross: number, rate: number) => ({ grossAmount: gross, vatRatePercent: rate, bounced: false });
  const zurueck = (gross: number, rate: number) => ({ grossAmount: gross, vatRatePercent: rate, bounced: true });

  it("addiert bezahlte Rechnungen zur Gesamtsumme", () => {
    const s = summarizeInvoices([bezahlt(120, 20), bezahlt(60, 20)]);
    expect(s.total.gross).toBe(180);
    expect(s.total.net).toBe(150);
    expect(s.total.vat).toBe(30);
  });

  // Der wichtigste Test der ganzen Datei: Zurückgebuchtes Geld ist nicht
  // eingegangen. Zählte es mit, behauptete die Zahl Einnahmen, die es nie gab.
  it("hält Rücklastschriften aus der Gesamtsumme heraus und weist sie getrennt aus", () => {
    const s = summarizeInvoices([bezahlt(120, 20), zurueck(60, 20)]);
    expect(s.total.gross).toBe(120);
    expect(s.bounced.gross).toBe(60);
  });

  it("trennt nach Steuersatz, aufsteigend sortiert", () => {
    const s = summarizeInvoices([bezahlt(110, 10), bezahlt(120, 20), bezahlt(220, 20)]);
    expect(s.byVatRate.map((r) => r.vatRatePercent)).toEqual([10, 20]);
    expect(s.byVatRate[0].gross).toBe(110);
    expect(s.byVatRate[1].gross).toBe(340);
  });

  it("zählt Rücklastschriften auch nicht in die Zwischensummen", () => {
    const s = summarizeInvoices([bezahlt(120, 20), zurueck(120, 20)]);
    expect(s.byVatRate).toHaveLength(1);
    expect(s.byVatRate[0].gross).toBe(120);
  });

  it("liefert bei leerer Auswahl Nullsummen statt eines Fehlers", () => {
    const s = summarizeInvoices([]);
    expect(s.total).toEqual({ net: 0, vat: 0, gross: 0 });
    expect(s.bounced).toEqual({ net: 0, vat: 0, gross: 0 });
    expect(s.byVatRate).toEqual([]);
  });

  // Die Spalte muss von Hand nachrechenbar sein: Summe der gerundeten
  // Einzelwerte, nicht die gerundete exakte Summe.
  it("summiert die bereits gerundeten Einzelbeträge", () => {
    const s = summarizeInvoices([bezahlt(0.05, 20), bezahlt(0.05, 20), bezahlt(0.05, 20)]);
    const einzelNetto = Math.round((0.05 / 1.2) * 100) / 100;
    expect(s.total.net).toBeCloseTo(einzelNetto * 3, 2);
  });
});

describe("CSV-Formatierung für Österreich (PROJ-36)", () => {
  it("schreibt Beträge mit Komma als Dezimalzeichen", () => {
    expect(formatAmountDe(45)).toBe("45,00");
    expect(formatAmountDe(1234.5)).toBe("1234,50");
    expect(formatAmountDe(0)).toBe("0,00");
  });

  it("trennt Spalten mit Semikolon", () => {
    expect(toCsvRow(["a", "b"])).toBe("a;b");
    expect(CSV_SEPARATOR).toBe(";");
  });

  // Bei Semikolon-Trennung braucht ein Komma keine Anführungszeichen mehr —
  // sonst stünde jeder Betrag unnötig in Anführungszeichen.
  it("setzt Beträge mit Komma nicht in Anführungszeichen", () => {
    expect(toCsvRow(["45,00"])).toBe("45,00");
  });

  it("schützt Felder, die ein Semikolon enthalten", () => {
    expect(toCsvRow(["Meier; Anna"])).toBe('"Meier; Anna"');
  });

  it("neutralisiert weiterhin Formel-Einleitungen im Kundennamen", () => {
    expect(toCsvRow(["=SUM(A1)"])).toBe("'=SUM(A1)");
  });
});

describe("Dateiname des Exports (PROJ-36)", () => {
  it("benennt einen vollen Monat nach diesem Monat", () => {
    expect(exportFileName("2026-08-01", "2026-08-31")).toBe("rechnungsjournal-2026-08.csv");
  });

  it("benennt einen freien Zeitraum nach seinen Grenzen", () => {
    expect(exportFileName("2026-07-01", "2026-08-15")).toBe("rechnungsjournal-2026-07-01_bis_2026-08-15.csv");
  });

  it("kommt mit einseitig offenen Zeiträumen und ohne Filter zurecht", () => {
    expect(exportFileName("2026-07-01", "")).toBe("rechnungsjournal-ab-2026-07-01.csv");
    expect(exportFileName("", "2026-07-31")).toBe("rechnungsjournal-bis-2026-07-31.csv");
    expect(exportFileName("", "")).toBe("rechnungsjournal-gesamt.csv");
  });
});

describe("Jahresauswahl für den Export (PROJ-36)", () => {
  it("spannt ein Jahr vom 1. Januar bis zum 31. Dezember auf", () => {
    expect(yearRange("2026")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });

  it("weist unsinnige Jahresangaben ab", () => {
    expect(yearRange("26")).toBeNull();
    expect(yearRange("2026-01")).toBeNull();
    expect(yearRange("")).toBeNull();
  });

  it("erkennt ein volles Jahr in einem Von/Bis-Paar wieder", () => {
    expect(yearFromRange("2026-01-01", "2026-12-31")).toBe("2026");
  });

  it("behandelt angebrochene Jahre nicht als Jahr", () => {
    expect(yearFromRange("2026-01-01", "2026-12-30")).toBeNull();
    expect(yearFromRange("2026-02-01", "2026-12-31")).toBeNull();
    expect(yearFromRange("2026-01-01", "2027-12-31")).toBeNull();
  });

  it("listet das aktuelle Jahr zuerst", () => {
    const years = recentYears(3, new Date(2026, 5, 1));
    expect(years.map((y) => y.value)).toEqual(["2026", "2025", "2024"]);
    expect(years[0].label).toBe("Jahr 2026");
  });

  // Januar bis Dezember ist ein Jahr, kein Monat — die beiden dürfen sich nicht
  // in die Quere kommen.
  it("hält Jahr und Monat auseinander", () => {
    expect(selectionFromRange("2026-01-01", "2026-12-31")).toMatchObject({ kind: "year", value: "2026" });
    expect(selectionFromRange("2026-01-01", "2026-01-31")).toMatchObject({ kind: "month", value: "2026-01" });
  });

  it("meldet alles andere als eigenen Zeitraum", () => {
    expect(selectionFromRange("2026-01-05", "2026-03-20").kind).toBe("custom");
    expect(selectionFromRange("", "").kind).toBe("custom");
  });

  // BUG-1: Auch ein Zeitraum, der nicht in der angebotenen Liste steht, muss
  // eine Beschriftung liefern — sonst bliebe die Auswahl leer.
  it("liefert für jeden erkannten Zeitraum eine Beschriftung, auch für weit zurückliegende", () => {
    expect(selectionFromRange("2019-03-01", "2019-03-31").label).toBe("März 2019");
    expect(selectionFromRange("2019-01-01", "2019-12-31").label).toBe("Jahr 2019");
    expect(selectionFromRange("2026-01-05", "2026-03-20").label).toBe("Eigener Zeitraum");
  });

  it("löst eine Auswahl wieder in einen Zeitraum auf", () => {
    expect(rangeFromSelection("2026")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(rangeFromSelection("2026-08")).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(rangeFromSelection("custom")).toEqual({ from: "", to: "" });
    expect(rangeFromSelection("Unsinn")).toBeNull();
  });

  it("benennt eine Jahresdatei nach dem Jahr", () => {
    expect(exportFileName("2026-01-01", "2026-12-31")).toBe("rechnungsjournal-2026.csv");
  });
});
