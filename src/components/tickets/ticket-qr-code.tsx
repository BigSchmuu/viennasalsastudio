"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function TicketQrCode({ ticketId }: { ticketId: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(ticketId, { width: 220, margin: 1 }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  if (!dataUrl) {
    return <div className="h-[220px] w-[220px] animate-pulse rounded-md bg-muted" />;
  }

  // eslint-disable-next-line @next/next/no-img-element -- data: URL, not an optimizable remote image
  return <img src={dataUrl} alt="Ticket-QR-Code" className="rounded-md border" width={220} height={220} />;
}
