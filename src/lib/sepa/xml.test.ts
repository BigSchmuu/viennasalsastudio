import { describe, it, expect } from "vitest";
import { generateSepaDirectDebitXml, type SepaXmlItem } from "./xml";

import { sepaKennung } from "./kennungen";
const baseItem: SepaXmlItem = {
  id: "item-1",
  amount: 45,
  iban: "AT611904300234573201",
  accountHolderName: "Max Mustermann",
  mandateReference: "VSS-ABC123",
  mandateSignedDate: "2026-01-01",
  sequenceType: "FRST",
  remittanceInfo: "Flatrate",
};

const baseInput = {
  messageId: "VSS-run-1",
  creationDateTime: "2026-08-14T10:00:00.000Z",
  dueDate: "2026-09-15",
  creditorName: "Vienna Salsa Studio",
  creditorIban: "AT552011185222099900",
  creditorId: "AT02ZZZ00000080604",
};

describe("generateSepaDirectDebitXml", () => {
  it("produces a well-formed pain.008 document with correct header totals", () => {
    const xml = generateSepaDirectDebitXml({ ...baseInput, items: [baseItem] });
    expect(xml).toContain('xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.08"');
    expect(xml).toContain("<NbOfTxs>1</NbOfTxs>");
    expect(xml).toContain("<CtrlSum>45.00</CtrlSum>");
    expect(xml).toContain("<ReqdColltnDt>2026-09-15</ReqdColltnDt>");
    expect(xml).toContain("<MndtId>VSS-ABC123</MndtId>");
    expect(xml).toContain("<IBAN>AT611904300234573201</IBAN>");
    expect(xml).toContain("<IBAN>AT552011185222099900</IBAN>");
  });

  it("uses NOTPROVIDED for both agents when no BIC is configured", () => {
    const xml = generateSepaDirectDebitXml({ ...baseInput, items: [baseItem] });
    const notProvidedCount = xml.split("NOTPROVIDED").length - 1;
    expect(notProvidedCount).toBe(2); // CdtrAgt + DbtrAgt
    expect(xml).not.toContain("<BICFI>");
  });

  it("uses the configured creditor BIC when provided", () => {
    const xml = generateSepaDirectDebitXml({ ...baseInput, creditorBic: "GIBAATWWXXX", items: [baseItem] });
    expect(xml).toContain("<BICFI>GIBAATWWXXX</BICFI>");
  });

  it("splits items into separate PmtInf blocks by sequence type", () => {
    const items: SepaXmlItem[] = [
      baseItem,
      { ...baseItem, id: "item-2", mandateReference: "VSS-DEF456", sequenceType: "RCUR", amount: 30 },
    ];
    const xml = generateSepaDirectDebitXml({ ...baseInput, items });
    const pmtInfCount = xml.split("<PmtInf>").length - 1;
    expect(pmtInfCount).toBe(2);
    expect(xml).toContain("<SeqTp>FRST</SeqTp>");
    expect(xml).toContain("<SeqTp>RCUR</SeqTp>");
    // Overall group header sums across both blocks
    expect(xml).toContain("<NbOfTxs>2</NbOfTxs>");
    expect(xml).toContain("<CtrlSum>75.00</CtrlSum>");
  });

  it("escapes XML special characters in names and remittance info", () => {
    const xml = generateSepaDirectDebitXml({
      ...baseInput,
      items: [{ ...baseItem, accountHolderName: `O'Brien & <Sons>`, remittanceInfo: `Kurs "Salsa"` }],
    });
    expect(xml).toContain("O&apos;Brien &amp; &lt;Sons&gt;");
    expect(xml).toContain("Kurs &quot;Salsa&quot;");
    expect(xml).not.toContain("<Sons>");
  });

  it("rounds amounts to 2 decimal places", () => {
    const xml = generateSepaDirectDebitXml({ ...baseInput, items: [{ ...baseItem, amount: 19.999 }] });
    expect(xml).toContain('<InstdAmt Ccy="EUR">20.00</InstdAmt>');
  });
});

describe("Längengrenzen der Kennungen (pain.008)", () => {
  // Der Fall aus dem Betrieb, 2026-09-16: Die Bank wies die Datei ab —
  // „Ungültige message id (msgId), in Zeile 13". Die Kennungen waren UUIDs,
  // mit Präfix 40, 45 und 36 Zeichen lang; die Norm erlaubt 35.
  const echteUuid = (n: number) => `3f2504e0-4f89-11d3-9a0c-0305e82c33${String(n).padStart(2, "0")}`;

  function xmlMitEchtenKennungen(): string {
    return generateSepaDirectDebitXml({
      ...baseInput,
      messageId: sepaKennung("VSS", echteUuid(1)),
      items: [
        { ...baseItem, id: echteUuid(2), sequenceType: "FRST" as const },
        { ...baseItem, id: echteUuid(3), sequenceType: "RCUR" as const },
      ],
    });
  }

  it("hält jede MsgId, PmtInfId und EndToEndId unter 36 Zeichen", () => {
    const xml = xmlMitEchtenKennungen();
    const felder = ["MsgId", "PmtInfId", "EndToEndId"];

    for (const feld of felder) {
      const treffer = [...xml.matchAll(new RegExp(`<${feld}>([^<]*)</${feld}>`, "g"))];
      expect(treffer.length, `${feld} kommt im Dokument vor`).toBeGreaterThan(0);
      for (const [, wert] of treffer) {
        expect(wert.length, `${feld} „${wert}"`).toBeLessThanOrEqual(35);
      }
    }
  });

  it("benutzt in den Kennungen nur Zeichen, die Banken annehmen", () => {
    const xml = xmlMitEchtenKennungen();
    for (const feld of ["MsgId", "PmtInfId", "EndToEndId"]) {
      for (const [, wert] of xml.matchAll(new RegExp(`<${feld}>([^<]*)</${feld}>`, "g"))) {
        expect(wert, `${feld} „${wert}"`).toMatch(/^[A-Za-z0-9-]+$/);
      }
    }
  });

  it("bricht ab, statt eine zu lange MsgId an die Bank zu schicken", () => {
    expect(() =>
      generateSepaDirectDebitXml({ ...baseInput, messageId: `VSS-${echteUuid(1)}`, items: [baseItem] })
    ).toThrow(/MsgId ist 40 Zeichen/);
  });
});

/**
 * PROJ-104: Die Umstellung auf ISO-2019.
 *
 * Geprüft wird am geparsten Dokument und nicht an Textstellen: Bei einer Datei,
 * die eine Bank gegen ein Schema hält, zählt die Reihenfolge der Elemente, und
 * ein `toContain` sieht sie nicht.
 */
function parse(xml: string): Document {
  const dokument = new DOMParser().parseFromString(xml, "application/xml");
  const fehler = dokument.getElementsByTagName("parsererror");
  if (fehler.length > 0) {
    throw new Error(`XML nicht wohlgeformt: ${fehler[0].textContent}`);
  }
  return dokument;
}

/** Die Namen der direkten Kindelemente, in Dokumentreihenfolge. */
function kinder(element: Element): string[] {
  return [...element.children].map((kind) => kind.localName ?? kind.nodeName);
}

const adresse = {
  strasse: "Beispielgasse",
  hausnummer: "1a",
  top: "Top 6",
  plz: "1010",
  ort: "Wien",
  land: "AT",
};

describe("PROJ-104: pain.008.001.08 und die strukturierte Adresse", () => {
  it("trägt den Namensraum der neuen Version und nirgends mehr den alten", () => {
    const xml = generateSepaDirectDebitXml({ ...baseInput, items: [baseItem] });
    expect(xml).toContain('xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.08"');
    expect(xml).not.toContain("pain.008.001.02");
    // Und das Dokument ist wohlgeformt.
    expect(parse(xml).documentElement.localName).toBe("Document");
  });

  it("schreibt die Adresse des Gläubigers in der Reihenfolge des Schemas", () => {
    const xml = generateSepaDirectDebitXml({
      ...baseInput,
      creditorAddress: adresse,
      items: [baseItem],
    });
    const cdtr = parse(xml).getElementsByTagName("Cdtr")[0];
    expect(kinder(cdtr)).toEqual(["Nm", "PstlAdr"]);

    const pstlAdr = cdtr.getElementsByTagName("PstlAdr")[0];
    // StrtNm, BldgNb, Room, PstCd, TwnNm, Ctry — Elemente 2.25, 2.26, 2.30,
    // 2.31, 2.32, 2.36. Die Nummer im Haus steht vor der Postleitzahl, nicht
    // dahinter; das Schema lässt da keine Wahl.
    expect(kinder(pstlAdr)).toEqual(["StrtNm", "BldgNb", "Room", "PstCd", "TwnNm", "Ctry"]);
    expect(pstlAdr.getElementsByTagName("Room")[0].textContent).toBe("Top 6");
    expect(pstlAdr.getElementsByTagName("TwnNm")[0].textContent).toBe("Wien");
    expect(pstlAdr.getElementsByTagName("Ctry")[0].textContent).toBe("AT");
  });

  it("schreibt niemals eine AdrLine — die Richtlinie verbietet sie", () => {
    const xml = generateSepaDirectDebitXml({
      ...baseInput,
      creditorAddress: adresse,
      items: [baseItem],
    });
    expect(xml).not.toContain("AdrLine");
    expect(parse(xml).getElementsByTagName("AdrLine")).toHaveLength(0);
  });

  it("kommt mit Ort und Land allein aus", () => {
    const xml = generateSepaDirectDebitXml({
      ...baseInput,
      creditorAddress: { ort: "Graz", land: "AT" },
      items: [baseItem],
    });
    const pstlAdr = parse(xml).getElementsByTagName("PstlAdr")[0];
    expect(kinder(pstlAdr)).toEqual(["TwnNm", "Ctry"]);
  });

  it("lässt die Adresse ganz weg, wenn keine konfiguriert ist", () => {
    for (const ohne of [{}, { creditorAddress: null }, { creditorAddress: undefined }]) {
      const xml = generateSepaDirectDebitXml({ ...baseInput, ...ohne, items: [baseItem] });
      expect(parse(xml).getElementsByTagName("PstlAdr")).toHaveLength(0);
    }
  });

  it("schreibt dem Zahlungspflichtigen keine Adresse — die braucht es im EWR nicht", () => {
    const xml = generateSepaDirectDebitXml({
      ...baseInput,
      creditorAddress: adresse,
      items: [baseItem],
    });
    const dbtr = parse(xml).getElementsByTagName("Dbtr")[0];
    expect(kinder(dbtr)).toEqual(["Nm"]);
  });

  it("kürzt einen Namen auf die 70 Zeichen der Richtlinie", () => {
    const langerName = "Maximiliane Friederike von Hohenbergen-Schwarzenstein-Lichtenfels-Waldau";
    expect(langerName.length).toBeGreaterThan(70);
    const xml = generateSepaDirectDebitXml({
      ...baseInput,
      items: [{ ...baseItem, accountHolderName: langerName }],
    });
    const name = parse(xml).getElementsByTagName("Dbtr")[0].getElementsByTagName("Nm")[0];
    expect(name.textContent).toBe(langerName.slice(0, 70));
    expect(name.textContent).toHaveLength(70);
  });

  it("kürzt den Verwendungszweck auf 140 Zeichen", () => {
    const lang = "Beitrag ".repeat(30);
    expect(lang.length).toBeGreaterThan(140);
    const xml = generateSepaDirectDebitXml({
      ...baseInput,
      items: [{ ...baseItem, remittanceInfo: lang }],
    });
    expect(parse(xml).getElementsByTagName("Ustrd")[0].textContent).toHaveLength(140);
  });

  it("lässt Umlaute stehen — erlaubt ist der national gebräuchliche Zeichensatz", () => {
    const xml = generateSepaDirectDebitXml({
      ...baseInput,
      creditorAddress: { ...adresse, strasse: "Währinger Straße", ort: "Wien" },
      items: [{ ...baseItem, accountHolderName: "Jürgen Müller-Lüdenscheid" }],
    });
    const dokument = parse(xml);
    expect(dokument.getElementsByTagName("Dbtr")[0].textContent).toContain("Jürgen Müller");
    expect(dokument.getElementsByTagName("StrtNm")[0].textContent).toBe("Währinger Straße");
  });

  it("behält die Reihenfolge der Blockelemente, mit und ohne Adresse", () => {
    for (const adressfall of [{ creditorAddress: adresse }, {}]) {
      const xml = generateSepaDirectDebitXml({ ...baseInput, ...adressfall, items: [baseItem] });
      const pmtInf = parse(xml).getElementsByTagName("PmtInf")[0];
      expect(kinder(pmtInf)).toEqual([
        "PmtInfId",
        "PmtMtd",
        "NbOfTxs",
        "CtrlSum",
        "PmtTpInf",
        "ReqdColltnDt",
        "Cdtr",
        "CdtrAcct",
        "CdtrAgt",
        "ChrgBr",
        "CdtrSchmeId",
        "DrctDbtTxInf",
      ]);
      const tx = pmtInf.getElementsByTagName("DrctDbtTxInf")[0];
      expect(kinder(tx)).toEqual([
        "PmtId",
        "InstdAmt",
        "DrctDbtTx",
        "DbtrAgt",
        "Dbtr",
        "DbtrAcct",
        "RmtInf",
      ]);
    }
  });
});
