import { normalizeIban } from "./iban";

import { sepaKennung, pruefeKennung } from "./kennungen";
import type { GlaeubigerAdresse } from "./glaeubiger-adresse";

/**
 * Längengrenzen der Richtlinie (EPC130-08, SDD Core C2PSP IGs 2025 V1.0).
 *
 * `Nm` ist dort auf 70 Zeichen begrenzt (ISO erlaubt 140), `Ustrd` auf 140.
 * Beides wird **gekürzt** und nicht abgewiesen: Ein fremder Kontoinhabername
 * ist nicht änderbar, und ein einziger langer Name darf nicht den ganzen Lauf
 * verhindern. Die Lastschrift ist über IBAN und Mandat identifiziert, nicht
 * über die letzten Buchstaben des Namens.
 */
export const SEPA_NAME_MAX = 70;
export const SEPA_USTRD_MAX = 140;

function aufLaenge(wert: string, grenze: number): string {
  return wert.length > grenze ? wert.slice(0, grenze) : wert;
}
export type SepaXmlItem = {
  id: string;
  amount: number;
  iban: string;
  accountHolderName: string;
  mandateReference: string;
  mandateSignedDate: string; // YYYY-MM-DD
  sequenceType: "FRST" | "RCUR";
  remittanceInfo: string;
};

export type SepaXmlInput = {
  messageId: string;
  creationDateTime: string; // ISO timestamp
  dueDate: string; // YYYY-MM-DD
  creditorName: string;
  creditorIban: string;
  creditorBic?: string;
  creditorId: string; // Gläubiger-ID
  /**
   * PROJ-104: Die strukturierte Adresse des Gläubigers — oder nichts.
   *
   * Die Richtlinie empfiehlt sie („Usage is recommended"), verlangt sie aber
   * nicht. Fehlt sie, bleibt die Datei gültig. Zusammengesetzt und geprüft
   * wird sie in `glaeubiger-adresse.ts`; hier kommt nur noch Brauchbares an.
   */
  creditorAddress?: GlaeubigerAdresse | null;
  items: SepaXmlItem[];
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Die Adresse im Schema-Takt.
 *
 * Die Reihenfolge der Felder ist nicht beliebig: Das Schema gibt sie vor
 * (StrtNm, BldgNb, Room, PstCd, TwnNm, Ctry — Elemente 2.25, 2.26, 2.30,
 * 2.31, 2.32, 2.36). Ein `AdrLine` kommt hier nicht vor und darf es nicht:
 * „'Address Line' is not allowed" in der strukturierten Form.
 */
function renderAdresse(adresse: GlaeubigerAdresse): string {
  const zeilen = [
    adresse.strasse ? `<StrtNm>${escapeXml(adresse.strasse)}</StrtNm>` : null,
    adresse.hausnummer ? `<BldgNb>${escapeXml(adresse.hausnummer)}</BldgNb>` : null,
    adresse.top ? `<Room>${escapeXml(adresse.top)}</Room>` : null,
    adresse.plz ? `<PstCd>${escapeXml(adresse.plz)}</PstCd>` : null,
    `<TwnNm>${escapeXml(adresse.ort)}</TwnNm>`,
    `<Ctry>${escapeXml(adresse.land)}</Ctry>`,
  ].filter(Boolean);

  return `
        <PstlAdr>
          ${zeilen.join("\n          ")}
        </PstlAdr>`;
}

function renderTransaction(item: SepaXmlItem): string {
  return `
      <DrctDbtTxInf>
        <PmtId>
          <EndToEndId>${sepaKennung("VSS", item.id)}</EndToEndId>
        </PmtId>
        <InstdAmt Ccy="EUR">${round2(item.amount).toFixed(2)}</InstdAmt>
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>${escapeXml(item.mandateReference)}</MndtId>
            <DtOfSgntr>${item.mandateSignedDate}</DtOfSgntr>
          </MndtRltdInf>
        </DrctDbtTx>
        <DbtrAgt>
          <FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId>
        </DbtrAgt>
        <Dbtr>
          <Nm>${escapeXml(aufLaenge(item.accountHolderName, SEPA_NAME_MAX))}</Nm>
        </Dbtr>
        <DbtrAcct>
          <Id><IBAN>${normalizeIban(item.iban)}</IBAN></Id>
        </DbtrAcct>
        <RmtInf>
          <Ustrd>${escapeXml(aufLaenge(item.remittanceInfo, SEPA_USTRD_MAX))}</Ustrd>
        </RmtInf>
      </DrctDbtTxInf>`;
}

/**
 * Erzeugt eine SEPA-Basislastschrift-Nachricht (`pain.008.001.08`).
 *
 * Positionen werden je Sequenztyp (FRST/RCUR) in eigene `PmtInf`-Blöcke
 * aufgeteilt, weil `ReqdColltnDt` und `SeqTp` am Block hängen und nicht an der
 * einzelnen Transaktion.
 *
 * PROJ-104: Bis zum 2026-11-17 war das `pain.008.001.02` — „ISO-2009". Die
 * Bank ließ die Datei mit einer Warnung durch und verwies auf die Frist: Laut
 * EPC-Richtlinie (Abschnitt 1.7) sind ab dem 22. November 2026 nur noch
 * strukturierte und hybride Adressen erlaubt, eine österreichische Bank nennt
 * den 16. November 2026. Zur Nachrichtenversion sagt die Richtlinie: „Only
 * pain.008.001.08 is allowed."
 *
 * Nebenbei richtig geworden: `<BICFI>` stand schon vorher hier, heißt aber
 * erst in dieser Version so — in `.02` war das Feld `<BIC>`. Gezündet hat der
 * Fehler nie, weil ohne konfigurierte BIC `NOTPROVIDED` geschrieben wird.
 */
export function generateSepaDirectDebitXml(input: SepaXmlInput): string {
  const totalAmount = round2(input.items.reduce((sum, item) => sum + item.amount, 0));
  const nbOfTxs = input.items.length;
  const creditorAgt = input.creditorBic
    ? `<FinInstnId><BICFI>${escapeXml(input.creditorBic)}</BICFI></FinInstnId>`
    : `<FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId>`;

  const adressblock = input.creditorAddress ? renderAdresse(input.creditorAddress) : "";

  const itemsBySequenceType = new Map<string, SepaXmlItem[]>();
  for (const item of input.items) {
    const group = itemsBySequenceType.get(item.sequenceType) ?? [];
    group.push(item);
    itemsBySequenceType.set(item.sequenceType, group);
  }

  // Vor dem Zusammenbauen prüfen, nicht erst an der Bankschranke: Eine zu
  // lange Kennung kostet den Betreiber sonst einen zweiten Gang zur Bank.
  pruefeKennung(input.messageId, "MsgId");

  const paymentBlocks = [...itemsBySequenceType.entries()]
    .map(([sequenceType, items]) => {
      pruefeKennung(`${input.messageId}-${sequenceType}`, "PmtInfId");
      const blockTotal = round2(items.reduce((sum, item) => sum + item.amount, 0));
      const blockTransactions = items.map(renderTransaction).join("");

      return `
    <PmtInf>
      <PmtInfId>${escapeXml(input.messageId)}-${sequenceType}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>${items.length}</NbOfTxs>
      <CtrlSum>${blockTotal.toFixed(2)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl><Cd>SEPA</Cd></SvcLvl>
        <LclInstrm><Cd>CORE</Cd></LclInstrm>
        <SeqTp>${sequenceType}</SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>${input.dueDate}</ReqdColltnDt>
      <Cdtr>
        <Nm>${escapeXml(aufLaenge(input.creditorName, SEPA_NAME_MAX))}</Nm>${adressblock}
      </Cdtr>
      <CdtrAcct>
        <Id><IBAN>${normalizeIban(input.creditorIban)}</IBAN></Id>
      </CdtrAcct>
      <CdtrAgt>
        ${creditorAgt}
      </CdtrAgt>
      <ChrgBr>SLEV</ChrgBr>
      <CdtrSchmeId>
        <Id>
          <PrvtId>
            <Othr>
              <Id>${escapeXml(input.creditorId)}</Id>
              <SchmeNm><Prtry>SEPA</Prtry></SchmeNm>
            </Othr>
          </PrvtId>
        </Id>
      </CdtrSchmeId>${blockTransactions}
    </PmtInf>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.08" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${escapeXml(input.messageId)}</MsgId>
      <CreDtTm>${input.creationDateTime}</CreDtTm>
      <NbOfTxs>${nbOfTxs}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <InitgPty>
        <Nm>${escapeXml(aufLaenge(input.creditorName, SEPA_NAME_MAX))}</Nm>
      </InitgPty>
    </GrpHdr>${paymentBlocks}
  </CstmrDrctDbtInitn>
</Document>
`;
}
