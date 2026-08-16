import { describe, it, expect } from "vitest";
import { generateSepaDirectDebitXml, type SepaXmlItem } from "./xml";

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
    expect(xml).toContain('xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02"');
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
