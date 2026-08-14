import { normalizeIban } from "./iban";

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

function renderTransaction(item: SepaXmlItem): string {
  return `
      <DrctDbtTxInf>
        <PmtId>
          <EndToEndId>${escapeXml(item.id)}</EndToEndId>
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
          <Nm>${escapeXml(item.accountHolderName)}</Nm>
        </Dbtr>
        <DbtrAcct>
          <Id><IBAN>${normalizeIban(item.iban)}</IBAN></Id>
        </DbtrAcct>
        <RmtInf>
          <Ustrd>${escapeXml(item.remittanceInfo)}</Ustrd>
        </RmtInf>
      </DrctDbtTxInf>`;
}

/**
 * Generates a SEPA Core Direct Debit Initiation message (pain.008.001.02).
 * Items are split into separate <PmtInf> blocks per sequence type (FRST vs
 * RCUR) since ReqdColltnDt/SeqTp apply at the block level, not per transaction.
 */
export function generateSepaDirectDebitXml(input: SepaXmlInput): string {
  const totalAmount = round2(input.items.reduce((sum, item) => sum + item.amount, 0));
  const nbOfTxs = input.items.length;
  const creditorAgt = input.creditorBic
    ? `<FinInstnId><BICFI>${escapeXml(input.creditorBic)}</BICFI></FinInstnId>`
    : `<FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId>`;

  const itemsBySequenceType = new Map<string, SepaXmlItem[]>();
  for (const item of input.items) {
    const group = itemsBySequenceType.get(item.sequenceType) ?? [];
    group.push(item);
    itemsBySequenceType.set(item.sequenceType, group);
  }

  const paymentBlocks = [...itemsBySequenceType.entries()]
    .map(([sequenceType, items]) => {
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
        <Nm>${escapeXml(input.creditorName)}</Nm>
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
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${escapeXml(input.messageId)}</MsgId>
      <CreDtTm>${input.creationDateTime}</CreDtTm>
      <NbOfTxs>${nbOfTxs}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <InitgPty>
        <Nm>${escapeXml(input.creditorName)}</Nm>
      </InitgPty>
    </GrpHdr>${paymentBlocks}
  </CstmrDrctDbtInitn>
</Document>
`;
}
