import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeutigeKurseListe } from "./heutige-kurse-liste";
import type { HeutigerKursEintrag } from "@/lib/dashboard/heutige-kurse-laden";

function eintrag(felder: Partial<HeutigerKursEintrag> = {}): HeutigerKursEintrag {
  return {
    kursId: "kurs-1",
    kursName: "Salsa Beginner",
    ort: "Studio 1",
    startZeit: "19:00:00",
    endZeit: "20:00:00",
    laeuft: false,
    stand: { erwartet: 12, anwesend: 3, erfasst: 5 },
    standText: "3 von 12 anwesend",
    ...felder,
  };
}

describe("HeutigeKurseListe (PROJ-75)", () => {
  it("führt mit einem Klick in die Anwesenheitsliste des Kurses", () => {
    render(<HeutigeKurseListe eintraege={[eintrag()]} />);
    const link = screen.getByRole("link", { name: /Salsa Beginner/ });
    expect(link).toHaveAttribute("href", "/lehrer/kurs-1");
  });

  it("zeigt Uhrzeit, Ort und Stand", () => {
    render(<HeutigeKurseListe eintraege={[eintrag()]} />);
    // Ohne Sekunden — die stehen in der Datenbank, nicht in der Tür.
    expect(screen.getByText("19:00")).toBeInTheDocument();
    expect(screen.getByText(/Studio 1/)).toBeInTheDocument();
    expect(screen.getByText(/3 von 12 anwesend/)).toBeInTheDocument();
  });

  it("kennzeichnet den laufenden Kurs", () => {
    render(<HeutigeKurseListe eintraege={[eintrag({ laeuft: true })]} />);
    expect(screen.getByText("läuft jetzt")).toBeInTheDocument();
  });

  it("kennzeichnet einen Kurs, der nicht läuft, nicht", () => {
    render(<HeutigeKurseListe eintraege={[eintrag({ laeuft: false })]} />);
    expect(screen.queryByText("läuft jetzt")).not.toBeInTheDocument();
  });

  // Eine leere Fläche ließe offen, ob heute nichts stattfindet oder die Liste
  // nicht geladen wurde.
  it("sagt an einem Tag ohne Kurs, dass kein Kurs stattfindet", () => {
    render(<HeutigeKurseListe eintraege={[]} />);
    expect(screen.getByText("Heute findet kein Kurs statt.")).toBeInTheDocument();
  });

  it("behält die Reihenfolge, in der die Einträge kommen", () => {
    render(
      <HeutigeKurseListe
        eintraege={[
          eintrag({ kursId: "a", kursName: "Erster", startZeit: "18:00:00" }),
          eintrag({ kursId: "b", kursName: "Zweiter", startZeit: "20:00:00" }),
        ]}
      />
    );
    const namen = screen.getAllByRole("link").map((l) => l.textContent);
    expect(namen[0]).toContain("Erster");
    expect(namen[1]).toContain("Zweiter");
  });

  it("verträgt einen Kurs ohne Ort und ohne Uhrzeit", () => {
    render(
      <HeutigeKurseListe
        eintraege={[eintrag({ ort: null, startZeit: null, endZeit: null })]}
      />
    );
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText(/Ohne Ort/)).toBeInTheDocument();
  });

  it("gibt einen unbekannten Stand als solchen weiter", () => {
    render(
      <HeutigeKurseListe
        eintraege={[eintrag({ stand: null, standText: "Stand unbekannt" })]}
      />
    );
    expect(screen.getByText(/Stand unbekannt/)).toBeInTheDocument();
  });
});
