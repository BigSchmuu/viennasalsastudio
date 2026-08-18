"use client";

import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

const SCANNER_ELEMENT_ID = "event-qr-scanner";

export function QrScanner({ onScan }: { onScan: (decodedText: string) => void }) {
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
    let stopped = false;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
          if (!stopped) onScanRef.current(decodedText);
        },
        () => {
          // per-frame "no QR code found" — expected constantly while aiming, not an error
        }
      )
      .catch(() => {
        // camera permission denied or unavailable — manual search fallback covers this
      });

    return () => {
      stopped = true;
      scanner.stop().catch(() => {});
    };
  }, []);

  return <div id={SCANNER_ELEMENT_ID} className="mx-auto w-full max-w-sm overflow-hidden rounded-md" />;
}
