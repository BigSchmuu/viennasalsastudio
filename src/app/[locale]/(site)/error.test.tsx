import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const sentryMelden = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureException: (fehler: unknown) => sentryMelden(fehler) }));

let sprache = "de";
vi.mock("next/navigation", () => ({ useParams: () => ({ locale: sprache }) }));

import SiteError from "./error";

/**
 * Die Auffangseite des Kundenbereichs (2026-09-27).
 *
 * Geprüft wird, was im Ernstfall zählt: Es steht etwas Verständliches da, es
 * gibt einen Weg weiter, und der Fehler wird gemeldet — sonst wüssten wir vom
 * nächsten Mal nichts.
 */
describe("Auffangseite im Kundenbereich", () => {
  beforeEach(() => {
    sprache = "de";
    sentryMelden.mockReset();
  });

  it("erklärt auf Deutsch, was zu tun ist", () => {
    render(<SiteError error={new Error("kaputt")} />);
    expect(screen.getByRole("heading", { name: "Da ist etwas schiefgelaufen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Seite neu laden" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zur Startseite" })).toHaveAttribute("href", "/");
  });

  it("und auf Englisch, wenn die Adresse englisch ist", () => {
    sprache = "en";
    render(<SiteError error={new Error("broken")} />);
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to homepage" })).toHaveAttribute("href", "/en");
  });

  it("nennt die Browsererweiterung als häufigste Ursache", () => {
    // Der gemeldete Fehler entsteht fast immer so. Wer das liest, weiß, warum
    // ein Neuladen hilft — und beschwert sich nicht über eine kaputte Seite.
    render(<SiteError error={new Error("removeChild")} />);
    expect(screen.getByText(/Browsererweiterung/)).toBeInTheDocument();
  });

  it("lädt die Seite wirklich neu, statt nur den Baum neu zu setzen", () => {
    // `reset()` setzt auf demselben kaputten Baum auf und fällt sofort wieder
    // um — deshalb ein echtes Neuladen.
    const neuLaden = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: neuLaden },
      writable: true,
    });

    render(<SiteError error={new Error("kaputt")} />);
    fireEvent.click(screen.getByRole("button", { name: "Seite neu laden" }));
    expect(neuLaden).toHaveBeenCalledTimes(1);
  });

  it("meldet den Fehler an Sentry", async () => {
    const fehler = new Error("gemeldet?");
    render(<SiteError error={fehler} />);
    // Sentry wird nachgeladen — der Aufruf kommt eine Mikroaufgabe später.
    await vi.waitFor(() => expect(sentryMelden).toHaveBeenCalledWith(fehler));
  });
});
