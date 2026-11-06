"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { kundenakteMitHerkunft } from "@/lib/navigation/herkunft";

/**
 * PROJ-100: Ein Link in die Kundenakte, der sagt, von welcher Seite er kommt.
 *
 * In die Akte führen 19 Stellen. Bis PROJ-100 baute jede ihr eigenes
 * `href={`/admin/kunden/${id}`}`, und die Akte konnte deshalb nur auf die
 * Kundenliste zurückführen — auf eine Seite, an der man meist nie war.
 *
 * Darum steht die Regel jetzt hier an einer Stelle: Das Bauteil liest die
 * eigene Adresse samt Suchteil (damit Filter und Suche zurückkommen) und hängt
 * sie als `?von=` an. Eine neue Liste erbt das, sobald sie dieses Bauteil
 * benutzt, statt den Fehler zu wiederholen.
 */
export function KundenLink({
  kundeId,
  className = "hover:underline",
  children,
}: {
  kundeId: string;
  className?: string;
  children: React.ReactNode;
}) {
  const pfad = usePathname();
  const suche = useSearchParams();

  const query = suche?.toString() ?? "";
  const herkunft = pfad ? (query ? `${pfad}?${query}` : pfad) : null;

  return (
    <Link href={kundenakteMitHerkunft(kundeId, herkunft)} className={className}>
      {children}
    </Link>
  );
}
